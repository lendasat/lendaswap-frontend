import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { useCallback, useEffect, useRef, useState } from "react";
import { EVENT_KINDS, STORAGE_KEYS, SUPPORT_NPUB } from "./constants";
import { sendNip17DM, unwrapGiftWrap } from "./nip17";
import { useNostr } from "./NostrProvider";
import type { ChatMessage, SupportProfile } from "./types";

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

function decodeSupportPubkey(): string {
  const decoded = nip19.decode(SUPPORT_NPUB);
  const pubkey = decoded.data as string;
  log("Support pubkey (hex):", pubkey);
  return pubkey;
}

export function useNostrChat() {
  const { ndk, user, connectionStatus, connect } = useNostr();
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [isSending, setIsSending] = useState(false);
  const [supportProfile, setSupportProfile] = useState<SupportProfile | null>(
    null,
  );
  const subRef = useRef<{ stop: () => void } | null>(null);
  const profileFetched = useRef(false);

  log(
    "useNostrChat render - connectionStatus:",
    connectionStatus,
    "ndk:",
    !!ndk,
    "user:",
    !!user,
  );

  // Persist messages to localStorage
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Fetch support agent profile (kind:0 metadata)
  useEffect(() => {
    if (!ndk || connectionStatus !== "connected" || profileFetched.current)
      return;
    profileFetched.current = true;

    const supportPubkey = decodeSupportPubkey();
    log("Fetching support agent profile for:", supportPubkey);

    const filter = { kinds: [0], authors: [supportPubkey] };
    const sub = ndk.subscribe(filter, { closeOnEose: true });

    sub.on("event", (event: NDKEvent) => {
      try {
        const metadata = JSON.parse(event.content);
        log(
          "Support agent profile:",
          metadata.name,
          metadata.picture ? "(has avatar)" : "(no avatar)",
        );
        setSupportProfile({
          name: metadata.name || metadata.display_name,
          picture: metadata.picture,
          about: metadata.about,
        });
      } catch (err) {
        logError("Failed to parse support profile:", err);
      }
    });
  }, [ndk, connectionStatus]);

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

    const supportPubkey = decodeSupportPubkey();
    log("Setting up NIP-17 gift wrap subscription for pubkey:", user.pubkey);
    let cancelled = false;

    (async () => {
      const unwrap = await unwrapGiftWrap(ndk, supportPubkey);

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

        // Only accept messages from the support agent
        if (sealPubkey !== supportPubkey) {
          log("Ignoring message from non-support pubkey:", sealPubkey);
          return;
        }

        addMessage({
          id: rumor.id || event.id || crypto.randomUUID(),
          content: rumor.content,
          direction: "received",
          timestamp: (rumor.created_at ?? Math.floor(Date.now() / 1000)) * 1000,
          status: "sent",
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
  }, [ndk, user, connectionStatus, addMessage]);

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

      const supportPubkey = decodeSupportPubkey();
      const tempId = crypto.randomUUID();
      const now = Date.now();

      log(
        "Sending message to support:",
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

        log("Sending NIP-17 gift-wrapped DM...");
        const rumor = await sendNip17DM(ndk, user, supportPubkey, text);
        log("NIP-17 send successful, rumor id:", rumor.id);

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
    [ndk, user, addMessage],
  );

  return {
    messages,
    sendMessage,
    isSending,
    connectionStatus,
    connect,
    supportProfile,
  };
}
