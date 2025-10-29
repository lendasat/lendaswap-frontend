import * as secp256k1 from "@noble/secp256k1";

const BITCOIN_SK_STORAGE_KEY = "lendaswap_bitcoin_sk";

/**
 * Generate a random Bitcoin private key (32 bytes)
 * @returns Hex string of the private key
 */
function generatePrivateKey(): string {
  const privateKey = secp256k1.utils.randomSecretKey();
  return Array.from(privateKey)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derive a compressed Bitcoin public key from a private key
 * @param privateKeyHex - Private key as hex string
 * @returns Compressed public key as hex string
 */
function derivePublicKey(privateKeyHex: string): string {
  const privateKeyBytes = Uint8Array.from(
    privateKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true); // true = compressed
  const publicKeyHex = Array.from(publicKeyBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${publicKeyHex}`;
}

/**
 * Get or create a Bitcoin key pair, storing the private key in localStorage
 * @returns Object containing the private key and derived public key
 */
export function getOrCreateBitcoinKeys(): {
  privateKey: string;
  publicKey: string;
} {
  // Try to load existing private key from localStorage
  let privateKey = localStorage.getItem(BITCOIN_SK_STORAGE_KEY);

  if (!privateKey) {
    // Generate new private key
    privateKey = generatePrivateKey();
    // Store it in localStorage
    localStorage.setItem(BITCOIN_SK_STORAGE_KEY, privateKey);
  }

  // Derive public key from private key
  const publicKey = derivePublicKey(privateKey);

  return { privateKey, publicKey };
}

/**
 * Clear the stored Bitcoin private key from localStorage
 * (Useful for testing or if user wants to reset their key)
 */
export function clearBitcoinKeys(): void {
  localStorage.removeItem(BITCOIN_SK_STORAGE_KEY);
}
