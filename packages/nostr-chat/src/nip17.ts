import type NDK from "@nostr-dev-kit/ndk";
import {
  NDKEvent,
  NDKPrivateKeySigner,
  type NDKUser,
} from "@nostr-dev-kit/ndk";
import { getEventHash } from "nostr-tools";
import { EVENT_KINDS } from "./constants";
import { createLogger } from "./logger";

const logger = createLogger("nostr-chat:nip17");

/**
 * Create NIP-17 gift-wrapped DMs for multiple recipients (group DM).
 *
 * Flow per recipient:
 *  1. Build unsigned kind:14 rumor with content + `p` tags for ALL recipients
 *  2. Seal it (kind:13) — encrypt with NIP-44 to each recipient individually
 *  3. Gift-wrap (kind:1059) with random ephemeral keypair per recipient
 *  4. Gift-wrap a self-copy (seal encrypted to first agent's pubkey, wrapped to self)
 *  5. Publish all gift wraps
 */
export async function sendNip17GroupDM(
  ndk: NDK,
  sender: NDKUser,
  recipientPubkeysHex: string[],
  content: string,
): Promise<NDKEvent> {
  logger.debug(
    "sendNip17GroupDM - sender:",
    sender.pubkey,
    "recipients:",
    recipientPubkeysHex.length,
  );

  // Build the kind:14 rumor with p tags for ALL participants (including sender per NIP-17 group DM spec)
  const allParticipants = [sender.pubkey, ...recipientPubkeysHex];
  const rumor = new NDKEvent(ndk);
  rumor.kind = EVENT_KINDS.RUMOR;
  rumor.content = content;
  rumor.tags = allParticipants.map((pk) => ["p", pk]);
  rumor.created_at = Math.floor(Date.now() / 1000);
  rumor.pubkey = sender.pubkey;

  // Compute the event id (required by NIP-17) without signing
  const rumorRaw = rumor.rawEvent();
  rumorRaw.id = getEventHash(rumorRaw as Parameters<typeof getEventHash>[0]);
  rumor.id = rumorRaw.id;
  logger.debug("Built kind:14 rumor, id:", rumor.id);

  // Seal + gift-wrap for each recipient
  for (const recipientPubkey of recipientPubkeysHex) {
    const seal = new NDKEvent(ndk);
    seal.kind = EVENT_KINDS.SEAL;
    seal.created_at = randomTimestamp();
    seal.pubkey = sender.pubkey;

    seal.content = await ndk.signer!.encrypt(
      ndk.getUser({ pubkey: recipientPubkey }),
      JSON.stringify(rumorRaw),
      "nip44",
    );
    await seal.sign();
    logger.debug(
      "Seal signed for recipient:",
      recipientPubkey.substring(0, 16) + "...",
    );

    const wrap = await giftWrap(ndk, seal, recipientPubkey);
    const result = await wrap.publish();
    logger.debug(
      "Gift wrap published to",
      result?.size ?? 0,
      "relays for recipient:",
      recipientPubkey.substring(0, 16) + "...",
    );
  }

  // Self-copy: seal encrypted to first agent's pubkey, gift-wrapped to self
  const selfSeal = new NDKEvent(ndk);
  selfSeal.kind = EVENT_KINDS.SEAL;
  selfSeal.created_at = randomTimestamp();
  selfSeal.pubkey = sender.pubkey;

  selfSeal.content = await ndk.signer!.encrypt(
    ndk.getUser({ pubkey: recipientPubkeysHex[0] }),
    JSON.stringify(rumorRaw),
    "nip44",
  );
  await selfSeal.sign();

  const wrapToSelf = await giftWrap(ndk, selfSeal, sender.pubkey);
  const selfResult = await wrapToSelf.publish();
  logger.debug(
    "Gift wrap to self published to",
    selfResult?.size ?? 0,
    "relays",
  );

  return rumor;
}

/**
 * Send a NIP-17 gift-wrapped DM to a single recipient.
 * Thin wrapper around sendNip17GroupDM for backward compatibility.
 */
export async function sendNip17DM(
  ndk: NDK,
  sender: NDKUser,
  recipientPubkeyHex: string,
  content: string,
): Promise<NDKEvent> {
  return sendNip17GroupDM(ndk, sender, [recipientPubkeyHex], content);
}

/**
 * Unwrap a received kind:1059 gift-wrap event to extract the inner kind:14 rumor.
 *
 * @param knownAgentPubkeys - Array of known agent hex pubkeys. When we receive our own
 *   self-copy, `seal.pubkey` is our own key, so decryption with it fails. We iterate
 *   through agent pubkeys as fallback to find the correct shared secret.
 */
export async function unwrapGiftWrap(
  ndk: NDK,
  knownAgentPubkeys: string[],
): Promise<
  (
    giftWrap: NDKEvent,
  ) => Promise<{ rumor: NDKEvent; sealPubkey: string } | null>
> {
  return async (giftWrap: NDKEvent) => {
    try {
      logger.debug(
        "Unwrapping gift wrap, id:",
        giftWrap.id,
        "from:",
        giftWrap.pubkey,
      );

      // Decrypt the gift-wrap content to get the seal
      const sealJson = await ndk.signer!.decrypt(
        ndk.getUser({ pubkey: giftWrap.pubkey }),
        giftWrap.content,
        "nip44",
      );
      const sealData = JSON.parse(sealJson);
      logger.debug(
        "Decrypted seal, kind:",
        sealData.kind,
        "from:",
        sealData.pubkey,
      );

      // Decrypt the seal content to get the rumor.
      // Try sealData.pubkey first (normal case: agent sent to us).
      // On failure, iterate all known agent pubkeys as fallback (self-copy case).
      let rumorJson: string | null = null;
      try {
        rumorJson = await ndk.signer!.decrypt(
          ndk.getUser({ pubkey: sealData.pubkey }),
          sealData.content,
          "nip44",
        );
      } catch {
        logger.debug(
          "Seal decryption failed with seal pubkey, trying known agent pubkeys...",
        );
        for (const agentPubkey of knownAgentPubkeys) {
          try {
            rumorJson = await ndk.signer!.decrypt(
              ndk.getUser({ pubkey: agentPubkey }),
              sealData.content,
              "nip44",
            );
            logger.debug(
              "Decrypted with agent pubkey:",
              agentPubkey.substring(0, 16) + "...",
            );
            break;
          } catch {
            // Try next agent
          }
        }
      }

      if (!rumorJson) {
        logger.error("Could not decrypt seal with any known pubkey");
        return null;
      }

      const rumorData = JSON.parse(rumorJson);
      logger.debug(
        "Decrypted rumor, kind:",
        rumorData.kind,
        "content length:",
        rumorData.content?.length,
      );

      const rumor = new NDKEvent(ndk, rumorData);
      return { rumor, sealPubkey: sealData.pubkey };
    } catch (err) {
      logger.error("Failed to unwrap gift wrap:", err);
      return null;
    }
  };
}

/**
 * Send a NIP-04 DM as fallback when NIP-17 fails.
 */
export async function sendNip04DM(
  ndk: NDK,
  recipientPubkeyHex: string,
  content: string,
): Promise<NDKEvent> {
  logger.debug("sendNip04DM - recipient:", recipientPubkeyHex);

  const event = new NDKEvent(ndk);
  event.kind = EVENT_KINDS.ENCRYPTED_DM;
  event.tags = [["p", recipientPubkeyHex]];

  logger.debug("Encrypting with NIP-04...");
  event.content = await ndk.signer!.encrypt(
    ndk.getUser({ pubkey: recipientPubkeyHex }),
    content,
    "nip04",
  );

  logger.debug("Publishing NIP-04 DM...");
  const result = await event.publish();
  logger.debug(
    "NIP-04 DM published to",
    result?.size ?? 0,
    "relays, id:",
    event.id,
  );
  return event;
}

async function giftWrap(
  ndk: NDK,
  seal: NDKEvent,
  recipientPubkeyHex: string,
): Promise<NDKEvent> {
  logger.debug(
    "giftWrap - recipient:",
    recipientPubkeyHex.substring(0, 16) + "...",
  );

  // Generate ephemeral keypair for the gift wrap
  const ephemeralBytes = crypto.getRandomValues(new Uint8Array(32));
  const ephemeralHex = Array.from(ephemeralBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const ephemeralSigner = new NDKPrivateKeySigner(ephemeralHex);
  const ephemeralUser = await ephemeralSigner.user();
  logger.debug(
    "Ephemeral pubkey:",
    ephemeralUser.pubkey.substring(0, 16) + "...",
  );

  const wrap = new NDKEvent(ndk);
  wrap.kind = EVENT_KINDS.GIFT_WRAP;
  wrap.created_at = randomTimestamp();
  wrap.pubkey = ephemeralUser.pubkey;
  wrap.tags = [["p", recipientPubkeyHex]];

  logger.debug("Encrypting gift wrap content with NIP-44...");
  wrap.content = await ephemeralSigner.encrypt(
    ndk.getUser({ pubkey: recipientPubkeyHex }),
    JSON.stringify(seal.rawEvent()),
    "nip44",
  );

  logger.debug("Signing gift wrap with ephemeral key...");
  await wrap.sign(ephemeralSigner);
  logger.debug("Gift wrap signed, id:", wrap.id);
  return wrap;
}

/** Random timestamp within the last 2 days (NIP-17 recommends jittered timestamps) */
function randomTimestamp(): number {
  const now = Math.floor(Date.now() / 1000);
  const twoDays = 2 * 24 * 60 * 60;
  return now - Math.floor(Math.random() * twoDays);
}
