import type NDK from "@nostr-dev-kit/ndk";
import {
  NDKEvent,
  NDKPrivateKeySigner,
  type NDKUser,
} from "@nostr-dev-kit/ndk";
import { getEventHash } from "nostr-tools";
import { EVENT_KINDS } from "./constants";

const log = (...args: unknown[]) => console.log("[nostr-chat:nip17]", ...args);
const logError = (...args: unknown[]) =>
  console.error("[nostr-chat:nip17]", ...args);

/**
 * Create a NIP-17 gift-wrapped DM and publish to relays.
 *
 * Flow:
 *  1. Build unsigned kind:14 rumor with content + `p` tag
 *  2. Seal it (kind:13) — encrypt with NIP-44 to recipient
 *  3. Gift-wrap (kind:1059) with random ephemeral keypair
 *  4. Gift-wrap a copy to self for conversation recovery
 *  5. Publish both gift wraps
 */
export async function sendNip17DM(
  ndk: NDK,
  sender: NDKUser,
  recipientPubkeyHex: string,
  content: string,
): Promise<NDKEvent> {
  log("sendNip17DM - sender:", sender.pubkey, "recipient:", recipientPubkeyHex);

  // Build the kind:14 rumor (unsigned inner event).
  // Per NIP-17: "The id MUST be computed as if it were being published."
  const rumor = new NDKEvent(ndk);
  rumor.kind = EVENT_KINDS.RUMOR;
  rumor.content = content;
  rumor.tags = [["p", recipientPubkeyHex]];
  rumor.created_at = Math.floor(Date.now() / 1000);
  rumor.pubkey = sender.pubkey;

  // Compute the event id (required by NIP-17) without signing
  const rumorRaw = rumor.rawEvent();
  rumorRaw.id = getEventHash(rumorRaw as Parameters<typeof getEventHash>[0]);
  rumor.id = rumorRaw.id;
  log("Built kind:14 rumor, id:", rumor.id);

  // Seal it (kind:13) — encrypt the rumor JSON to recipient
  const seal = new NDKEvent(ndk);
  seal.kind = EVENT_KINDS.SEAL;
  seal.created_at = randomTimestamp();
  seal.pubkey = sender.pubkey;
  log("Encrypting seal with NIP-44...");
  seal.content = await ndk.signer!.encrypt(
    ndk.getUser({ pubkey: recipientPubkeyHex }),
    JSON.stringify(rumorRaw),
    "nip44",
  );
  log("Signing seal...");
  await seal.sign();
  log("Seal signed, id:", seal.id);

  // Gift-wrap to recipient
  log("Gift-wrapping to recipient...");
  const wrapToRecipient = await giftWrap(ndk, seal, recipientPubkeyHex);
  log("Publishing gift wrap to recipient...");
  const recipientResult = await wrapToRecipient.publish();
  log(
    "Gift wrap to recipient published to",
    recipientResult?.size ?? 0,
    "relays",
  );

  // Gift-wrap copy to self
  log("Gift-wrapping to self...");
  const wrapToSelf = await giftWrap(ndk, seal, sender.pubkey);
  log("Publishing gift wrap to self...");
  const selfResult = await wrapToSelf.publish();
  log("Gift wrap to self published to", selfResult?.size ?? 0, "relays");

  return rumor;
}

/**
 * Unwrap a received kind:1059 gift-wrap event to extract the inner kind:14 rumor.
 *
 * @param conversationPartnerPubkey - The other party's pubkey hex. Needed because
 *   the seal is encrypted between sender↔recipient. When we receive our own self-copy,
 *   `seal.pubkey` is our own key, so decryption with it fails (wrong shared secret).
 *   We retry with the partner's pubkey in that case.
 */
export async function unwrapGiftWrap(
  ndk: NDK,
  conversationPartnerPubkey: string,
): Promise<
  (
    giftWrap: NDKEvent,
  ) => Promise<{ rumor: NDKEvent; sealPubkey: string } | null>
> {
  return async (giftWrap: NDKEvent) => {
    try {
      log("Unwrapping gift wrap, id:", giftWrap.id, "from:", giftWrap.pubkey);

      // Decrypt the gift-wrap content to get the seal
      const sealJson = await ndk.signer!.decrypt(
        ndk.getUser({ pubkey: giftWrap.pubkey }),
        giftWrap.content,
        "nip44",
      );
      const sealData = JSON.parse(sealJson);
      log("Decrypted seal, kind:", sealData.kind, "from:", sealData.pubkey);

      // Decrypt the seal content to get the rumor.
      // The seal was encrypted from sender→recipient. If we ARE the sender (self-copy),
      // sealData.pubkey is our own key — decrypting against it uses the wrong shared secret.
      // Try sealData.pubkey first; on failure, retry with the conversation partner's pubkey.
      let rumorJson: string;
      try {
        rumorJson = await ndk.signer!.decrypt(
          ndk.getUser({ pubkey: sealData.pubkey }),
          sealData.content,
          "nip44",
        );
      } catch {
        log(
          "Seal decryption failed with seal pubkey, retrying with partner pubkey:",
          conversationPartnerPubkey.substring(0, 16) + "...",
        );
        rumorJson = await ndk.signer!.decrypt(
          ndk.getUser({ pubkey: conversationPartnerPubkey }),
          sealData.content,
          "nip44",
        );
      }

      const rumorData = JSON.parse(rumorJson);
      log(
        "Decrypted rumor, kind:",
        rumorData.kind,
        "content length:",
        rumorData.content?.length,
      );

      const rumor = new NDKEvent(ndk, rumorData);
      return { rumor, sealPubkey: sealData.pubkey };
    } catch (err) {
      logError("Failed to unwrap gift wrap:", err);
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
  log("sendNip04DM - recipient:", recipientPubkeyHex);

  const event = new NDKEvent(ndk);
  event.kind = EVENT_KINDS.ENCRYPTED_DM;
  event.tags = [["p", recipientPubkeyHex]];

  log("Encrypting with NIP-04...");
  event.content = await ndk.signer!.encrypt(
    ndk.getUser({ pubkey: recipientPubkeyHex }),
    content,
    "nip04",
  );

  log("Publishing NIP-04 DM...");
  const result = await event.publish();
  log("NIP-04 DM published to", result?.size ?? 0, "relays, id:", event.id);
  return event;
}

async function giftWrap(
  ndk: NDK,
  seal: NDKEvent,
  recipientPubkeyHex: string,
): Promise<NDKEvent> {
  log("giftWrap - recipient:", recipientPubkeyHex.substring(0, 16) + "...");

  // Generate ephemeral keypair for the gift wrap
  const ephemeralBytes = crypto.getRandomValues(new Uint8Array(32));
  const ephemeralHex = Array.from(ephemeralBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const ephemeralSigner = new NDKPrivateKeySigner(ephemeralHex);
  const ephemeralUser = await ephemeralSigner.user();
  log("Ephemeral pubkey:", ephemeralUser.pubkey.substring(0, 16) + "...");

  const wrap = new NDKEvent(ndk);
  wrap.kind = EVENT_KINDS.GIFT_WRAP;
  wrap.created_at = randomTimestamp();
  wrap.pubkey = ephemeralUser.pubkey;
  wrap.tags = [["p", recipientPubkeyHex]];

  log("Encrypting gift wrap content with NIP-44...");
  wrap.content = await ephemeralSigner.encrypt(
    ndk.getUser({ pubkey: recipientPubkeyHex }),
    JSON.stringify(seal.rawEvent()),
    "nip44",
  );

  log("Signing gift wrap with ephemeral key...");
  await wrap.sign(ephemeralSigner);
  log("Gift wrap signed, id:", wrap.id);
  return wrap;
}

/** Random timestamp within the last 2 days (NIP-17 recommends jittered timestamps) */
function randomTimestamp(): number {
  const now = Math.floor(Date.now() / 1000);
  const twoDays = 2 * 24 * 60 * 60;
  return now - Math.floor(Math.random() * twoDays);
}
