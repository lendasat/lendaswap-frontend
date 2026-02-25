import NDK, { NDKPrivateKeySigner, type NDKUser } from "@nostr-dev-kit/ndk";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_RELAYS, STORAGE_KEYS } from "./constants";
import { createLogger } from "./logger";
import type { ConnectionStatus } from "./types";

const logger = createLogger("nostr-chat");

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
    logger.debug("Using existing private key from localStorage");
    return stored;
  }

  // Generate 32 random bytes as hex
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, hex);
  logger.debug("Generated and stored new private key");
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
      logger.debug("Already connected or connecting, skipping");
      return;
    }

    logger.info("Connecting to relays:", relays);
    setConnectionStatus("connecting");
    try {
      const keyHex = privateKeyHex ?? getOrCreatePrivateKey();
      logger.debug("Creating signer...");
      const signer = new NDKPrivateKeySigner(keyHex);

      const ndk = new NDK({
        explicitRelayUrls: relays,
        signer,
        aiGuardrails: { skip: new Set(["ndk-no-cache"]) },
      });

      const ndkUser = await signer.user();
      logger.debug("User pubkey:", ndkUser.pubkey);
      logger.debug("User npub:", ndkUser.npub);

      // Store refs before connecting so they're available once a relay connects
      ndkRef.current = ndk;
      setUser(ndkUser);

      // Listen to relay connection events — mark as connected on first relay
      let connected = false;
      ndk.pool.on("relay:connect", (relay: { url: string }) => {
        logger.debug("Relay connected:", relay.url);
        if (!connected) {
          connected = true;
          setConnectionStatus("connected");
          logger.info("First relay connected — status set to connected");
        }
      });
      ndk.pool.on("relay:disconnect", (relay: { url: string }) => {
        logger.debug("Relay disconnected:", relay.url);
      });

      // ndk.connect() is fire-and-forget — it does not reliably resolve its promise
      logger.debug("Calling ndk.connect() (fire-and-forget)...");
      ndk.connect().catch((err: unknown) => {
        logger.error("ndk.connect() errored:", err);
      });
    } catch (err) {
      logger.error("Connection setup failed:", err);
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
