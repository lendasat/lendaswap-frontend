import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENT_KINDS, STORAGE_KEYS } from "./constants";
import { sendNip17GroupDM, unwrapGiftWrap } from "./nip17";
import { useNostr } from "./NostrProvider";
import type { AgentConfig, AgentProfile, ChatMessage } from "./types";

const log = (...args: unknown[]) => console.log("[nostr-chat]", ...args);
const logError = (...args: unknown[]) => console.error("[nostr-chat]", ...args);

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    const msgs = raw ? JSON.parse(raw) : [];
    log("Loaded", msgs.length, "messages from localStorage");
    return msgs;
  } catch {
    log("Failed to load messages from localStorage, starting fresh");
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
}

export function useNostrChat(agents: AgentConfig[]) {
  const { ndk, user, connectionStatus, connect } = useNostr();
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [isSending, setIsSending] = useState(false);
  const [agentProfiles, setAgentProfiles] = useState<Map<string, AgentProfile>>(
    new Map(),
  );
  const subRef = useRef<{ stop: () => void } | null>(null);
  const profileFetched = useRef(false);

  // Decode all agent npubs to hex pubkeys
  const agentPubkeys = useMemo(() => {
    return agents.map((agent) => {
      const decoded = nip19.decode(agent.npub);
      return decoded.data as string;
    });
  }, [agents]);

  // Set of agent pubkeys for fast lookup
  const agentPubkeySet = useMemo(() => new Set(agentPubkeys), [agentPubkeys]);

  // Map from hex pubkey to AgentConfig (for consumer overrides)
  const agentConfigByPubkey = useMemo(() => {
    const map = new Map<string, AgentConfig>();
    agents.forEach((agent, i) => {
      map.set(agentPubkeys[i], agent);
    });
    return map;
  }, [agents, agentPubkeys]);

  log(
    "useNostrChat render - connectionStatus:",
    connectionStatus,
    "ndk:",
    !!ndk,
    "user:",
    !!user,
    "agents:",
    agents.length,
  );

  // Persist messages to localStorage
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Fetch agent profiles (kind:0 metadata) with retry for missing avatars
  useEffect(() => {
    if (
      !ndk ||
      connectionStatus !== "connected" ||
      profileFetched.current ||
      agentPubkeys.length === 0
    )
      return;
    profileFetched.current = true;

    let cancelled = false;

    async function fetchProfiles(authors: string[], attempt: number) {
      log(`Fetching agent profiles (attempt ${attempt}) for:`, authors);

      const events = await ndk!.fetchEvents({
        kinds: [0],
        authors,
      });

      if (cancelled) return;

      const resolved = new Set<string>();

      for (const event of events) {
        try {
          const metadata = JSON.parse(event.content);
          const pubkey = event.pubkey;
          const config = agentConfigByPubkey.get(pubkey);

          log(
            "Agent profile:",
            pubkey.substring(0, 16) + "...",
            metadata.name,
            metadata.picture ? "(has avatar)" : "(no avatar)",
          );

          if (metadata.picture || metadata.name) {
            resolved.add(pubkey);
          }

          setAgentProfiles((prev) => {
            const next = new Map(prev);
            next.set(pubkey, {
              pubkeyHex: pubkey,
              name: config?.name || metadata.name || metadata.display_name,
              picture: config?.picture || metadata.picture,
            });
            return next;
          });
        } catch (err) {
          logError("Failed to parse agent profile:", err);
        }
      }

      // Ensure all agents have a profile entry (even without kind:0 metadata)
      setAgentProfiles((prev) => {
        const next = new Map(prev);
        for (const [pubkey, config] of agentConfigByPubkey) {
          if (!next.has(pubkey)) {
            next.set(pubkey, {
              pubkeyHex: pubkey,
              name: config.name,
              picture: config.picture,
            });
          }
        }
        return next;
      });

      // Retry once for agents that came back without a picture
      if (attempt < 2) {
        const missing = authors.filter((pk) => !resolved.has(pk));
        if (missing.length > 0 && !cancelled) {
          log("Retrying profile fetch for", missing.length, "agents without avatar");
          setTimeout(() => {
            if (!cancelled) fetchProfiles(missing, attempt + 1);
          }, 3000);
        }
      }
    }

    fetchProfiles(agentPubkeys, 1);

    return () => {
      cancelled = true;
    };
  }, [ndk, connectionStatus, agentPubkeys, agentConfigByPubkey]);

  // Add message with dedup
  const addMessage = useCallback((msg: ChatMessage) => {
    log("Adding message:", msg.id, msg.direction, msg.status);
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) {
        log("Duplicate message, skipping:", msg.id);
        return prev;
      }
      return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
    });
  }, []);

  // Subscribe to incoming gift wraps (NIP-17)
  useEffect(() => {
    if (!ndk || !user || connectionStatus !== "connected") {
      log(
        "Skipping NIP-17 subscription - ndk:",
        !!ndk,
        "user:",
        !!user,
        "status:",
        connectionStatus,
      );
      return;
    }

    log("Setting up NIP-17 gift wrap subscription for pubkey:", user.pubkey);
    let cancelled = false;

    (async () => {
      const unwrap = await unwrapGiftWrap(ndk, agentPubkeys);

      const filter = {
        kinds: [EVENT_KINDS.GIFT_WRAP as number],
        "#p": [user.pubkey],
        since: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
      };
      log("NIP-17 subscription filter:", JSON.stringify(filter));

      const sub = ndk.subscribe(filter, { closeOnEose: false });

      sub.on("event", async (event: NDKEvent) => {
        log("Received gift wrap event:", event.id);
        if (cancelled) return;
        const result = await unwrap(event);
        if (!result) {
          log("Failed to unwrap gift wrap event:", event.id);
          return;
        }

        const { rumor, sealPubkey } = result;
        log("Unwrapped rumor from:", sealPubkey);

        // Self-copy: seal was created by us → skip (already added optimistically)
        if (sealPubkey === user.pubkey) {
          log("Ignoring self-copy gift wrap from our own pubkey");
          return;
        }

        // Only accept messages from known agents
        if (!agentPubkeySet.has(sealPubkey)) {
          log("Ignoring message from unknown pubkey:", sealPubkey);
          return;
        }

        addMessage({
          id: rumor.id || event.id || crypto.randomUUID(),
          content: rumor.content,
          direction: "received",
          timestamp: (rumor.created_at ?? Math.floor(Date.now() / 1000)) * 1000,
          status: "sent",
          senderPubkey: sealPubkey,
        });
      });

      sub.on("eose", () => {
        log("NIP-17 subscription EOSE received");
      });

      subRef.current = { stop: () => sub.stop() };
    })();

    return () => {
      log("Cleaning up NIP-17 subscription");
      cancelled = true;
      subRef.current?.stop();
    };
  }, [ndk, user, connectionStatus, addMessage, agentPubkeys, agentPubkeySet]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!ndk || !user || !content.trim()) {
        log(
          "Cannot send - ndk:",
          !!ndk,
          "user:",
          !!user,
          "content:",
          !!content.trim(),
        );
        return;
      }

      const tempId = crypto.randomUUID();
      const now = Date.now();

      log(
        "Sending message to",
        agentPubkeys.length,
        "agents:",
        content.trim().substring(0, 50) + "...",
      );

      // Optimistically add the message
      addMessage({
        id: tempId,
        content: content.trim(),
        direction: "sent",
        timestamp: now,
        status: "sending",
      });

      setIsSending(true);
      try {
        const text = content.trim();

        log("Sending NIP-17 group gift-wrapped DM...");
        const rumor = await sendNip17GroupDM(ndk, user, agentPubkeys, text);
        log("NIP-17 group send successful, rumor id:", rumor.id);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, id: rumor.id || tempId, status: "sent" as const }
              : m,
          ),
        );
      } catch (err) {
        logError("Failed to send message:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, status: "failed" as const } : m,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [ndk, user, addMessage, agentPubkeys],
  );

  return {
    messages,
    sendMessage,
    isSending,
    connectionStatus,
    connect,
    agentProfiles,
  };
}
