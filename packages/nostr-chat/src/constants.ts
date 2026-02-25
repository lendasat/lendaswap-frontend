
/** Default relay URLs */
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
  "wss://relay.primal.net",
];

/** localStorage keys */
export const STORAGE_KEYS = {
  MESSAGES: "lendaswap:chat:messages",
  PRIVATE_KEY: "lendaswap:chat:privateKey",
} as const;

/** NIP event kind numbers */
export const EVENT_KINDS = {
  /** NIP-04 encrypted DM */
  ENCRYPTED_DM: 4,
  /** NIP-17 seal */
  SEAL: 13,
  /** NIP-17 rumor (unsigned kind:14) */
  RUMOR: 14,
  /** NIP-17 gift wrap */
  GIFT_WRAP: 1059,
} as const;
