import NDK, { NDKPrivateKeySigner, type NDKUser } from "@nostr-dev-kit/ndk";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_RELAYS, STORAGE_KEYS } from "./constants";
import type { ConnectionStatus } from "./types";

const log = (...args: unknown[]) => console.log("[nostr-chat]", ...args);
const logError = (...args: unknown[]) => console.error("[nostr-chat]", ...args);

interface NostrContextValue {
  ndk: NDK | null;
  user: NDKUser | null;
  connectionStatus: ConnectionStatus;
  connect: () => Promise<void>;
}

const NostrContext = createContext<NostrContextValue>({
  ndk: null,
  user: null,
  connectionStatus: "disconnected",
  connect: async () => {},
});

export function useNostr() {
  return useContext(NostrContext);
}

function getOrCreatePrivateKey(): string {
  const stored = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
  if (stored) {
    log("Using existing private key from localStorage");
    return stored;
  }

  // Generate 32 random bytes as hex
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, hex);
  log("Generated and stored new private key");
  return hex;
}

interface NostrProviderProps {
  children: ReactNode;
  privateKeyHex?: string;
  relays?: string[];
}

export function NostrProvider({
  children,
  privateKeyHex,
  relays = DEFAULT_RELAYS,
}: NostrProviderProps) {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [user, setUser] = useState<NDKUser | null>(null);
  const ndkRef = useRef<NDK | null>(null);

  const connect = useCallback(async () => {
    if (ndkRef.current && connectionStatus !== "disconnected") {
      log("Already connected or connecting, skipping");
      return;
    }

    log("Connecting to relays:", relays);
    setConnectionStatus("connecting");
    try {
      const keyHex = privateKeyHex ?? getOrCreatePrivateKey();
      log("Creating signer...");
      const signer = new NDKPrivateKeySigner(keyHex);

      const ndk = new NDK({
        explicitRelayUrls: relays,
        signer,
        aiGuardrails: true,
      });

      const ndkUser = await signer.user();
      log("User pubkey:", ndkUser.pubkey);
      log("User npub:", ndkUser.npub);

      // Store refs before connecting so they're available once a relay connects
      ndkRef.current = ndk;
      setUser(ndkUser);

      // Listen to relay connection events — mark as connected on first relay
      let connected = false;
      ndk.pool.on("relay:connect", (relay: { url: string }) => {
        log("Relay connected:", relay.url);
        if (!connected) {
          connected = true;
          setConnectionStatus("connected");
          log("First relay connected — status set to connected");
        }
      });
      ndk.pool.on("relay:disconnect", (relay: { url: string }) => {
        log("Relay disconnected:", relay.url);
      });

      // ndk.connect() is fire-and-forget — it does not reliably resolve its promise
      log("Calling ndk.connect() (fire-and-forget)...");
      ndk.connect().catch((err: unknown) => {
        logError("ndk.connect() errored:", err);
      });
    } catch (err) {
      logError("Connection setup failed:", err);
      ndkRef.current = null;
      setUser(null);
      setConnectionStatus("disconnected");
    }
  }, [privateKeyHex, relays, connectionStatus]);

  const value = useMemo<NostrContextValue>(
    () => ({
      ndk: ndkRef.current,
      user,
      connectionStatus,
      connect,
    }),
    [user, connectionStatus, connect],
  );

  return (
    <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
  );
}
