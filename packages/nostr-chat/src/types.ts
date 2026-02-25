export type MessageStatus = "sending" | "sent" | "failed";
export type MessageDirection = "sent" | "received";

export interface ChatMessage {
  id: string;
  content: string;
  direction: MessageDirection;
  timestamp: number;
  status: MessageStatus;
  /** Hex pubkey of the agent who sent this message (only for received messages) */
  senderPubkey?: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

/** Consumer-facing agent configuration */
export interface AgentConfig {
  /** NIP-19 encoded npub */
  npub: string;
  /** Display name override (fallback to kind:0 metadata) */
  name?: string;
  /** Avatar URL override (fallback to kind:0 metadata) */
  picture?: string;
}

/** Resolved agent profile with hex pubkey */
export interface AgentProfile {
  pubkeyHex: string;
  name?: string;
  picture?: string;
}
