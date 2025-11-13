import init, {
  refund_vhtlc,
  claim_vhtlc,
  amounts_for_swap,
  generate_or_get_mnemonic,
  get_mnemonic,
  import_mnemonic,
  derive_swap_params,
  derive_swap_params_at_index,
  get_user_id_xpub,
} from "../wasm/browser_wallet.js";

export interface VhtlcAmounts {
  spendable: number;
  spent: number;
  recoverable: number;
}

let wasmInitPromise: Promise<void> | null = null;

/**
 * Initialize the browser wallet WASM module.
 * This must be called before using any other functions.
 * Note: The logger is automatically initialized when the WASM module loads.
 *
 * This function is idempotent and safe to call multiple times.
 */
export async function initBrowserWallet(): Promise<void> {
  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = init().then(() => {
    // Initialization complete
  });

  return wasmInitPromise;
}

/**
 * Get the amounts for a swap (spendable, spent, recoverable).
 *
 * @param arkServerUrl - The URL of the Arkade server
 * @param swapId - The swap ID (UUID)
 * @returns Object containing spendable, spent, and recoverable amounts in satoshis
 */
export async function getAmountsForSwap(
  arkServerUrl: string,
  swapId: string,
): Promise<VhtlcAmounts> {
  if (!wasmInitPromise) {
    throw new Error(
      "Browser wallet not initialized. Call initBrowserWallet() first.",
    );
  }

  const wasmAmounts = await amounts_for_swap(arkServerUrl, swapId);
  return {
    spendable: Number(wasmAmounts.spendable),
    spent: Number(wasmAmounts.spent),
    recoverable: Number(wasmAmounts.recoverable),
  };
}

/**
 * Refund a VHTLC swap.
 *
 * @param arkServerUrl - The URL of the Arkade server
 * @param swapId - The swap ID (UUID)
 * @param refundAddress - The Arkade address to refund to
 * @returns The transaction ID of the refund
 */
export async function refundVhtlc(
  arkServerUrl: string,
  swapId: string,
  refundAddress: string,
): Promise<string> {
  if (!wasmInitPromise) {
    throw new Error(
      "Browser wallet not initialized. Call initBrowserWallet() first.",
    );
  }

  return await refund_vhtlc(arkServerUrl, swapId, refundAddress);
}

/**
 * Claim a VHTLC swap.
 *
 * @param arkServerUrl - The URL of the Arkade server
 * @param swapId - The swap ID (UUID)
 * @param claimAddress - The Arkade address to claim to
 * @returns The transaction ID of the claim
 */
export async function claimVhtlc(
  arkServerUrl: string,
  swapId: string,
  claimAddress: string,
): Promise<string> {
  if (!wasmInitPromise) {
    throw new Error(
      "Browser wallet not initialized. Call initBrowserWallet() first.",
    );
  }

  return await claim_vhtlc(arkServerUrl, swapId, claimAddress);
}

// ============================================================================
// HD Wallet Functions
// ============================================================================

export interface SwapParams {
  ownSk: string;
  ownPk: string;
  preimage: string;
  preimageHash: string;
  userId: string;
  keyIndex: number;
}

/**
 * Generate or get existing mnemonic phrase.
 * If a mnemonic already exists in storage, it returns that.
 * Otherwise, generates a new 12-word mnemonic and stores it.
 *
 * @returns The mnemonic phrase as a string
 */
export async function generateOrGetMnemonic(): Promise<string> {
  if (!wasmInitPromise) {
    throw new Error(
      "Browser wallet not initialized. Call initBrowserWallet() first.",
    );
  }

  return generate_or_get_mnemonic();
}

/**
 * Get the current mnemonic phrase from storage.
 * Use this for displaying the backup phrase to the user.
 *
 * @returns The mnemonic phrase if it exists, null otherwise
 */
export async function getMnemonic(): Promise<string | null> {
  if (!wasmInitPromise) {
    throw new Error(
      "Browser wallet not initialized. Call initBrowserWallet() first.",
    );
  }

  const result = get_mnemonic();
  return result || null;
}

/**
 * Import a mnemonic phrase (for wallet recovery).
 * This will replace any existing mnemonic.
 *
 * @param phrase - The mnemonic phrase to import
 */
export async function importMnemonic(phrase: string): Promise<void> {
  if (!wasmInitPromise) {
    throw new Error(
      "Browser wallet not initialized. Call initBrowserWallet() first.",
    );
  }

  return import_mnemonic(phrase);
}

/**
 * Derive swap parameters for a new swap.
 * This automatically increments the derivation index.
 *
 * @returns Object containing ownSk (hex), ownPk (hex), preimage(hex), preimageHash (hex), userId (hex), and index
 */
export async function deriveSwapParams(): Promise<SwapParams> {
  if (!wasmInitPromise) {
    throw new Error(
      "Browser wallet not initialized. Call initBrowserWallet() first.",
    );
  }

  const result = derive_swap_params();

  // Convert from WASM snake_case to JavaScript camelCase
  return {
    ownSk: result.own_sk,
    ownPk: result.own_pk,
    preimage: result.preimage,
    preimageHash: result.preimage_hash,
    userId: result.user_id,
    keyIndex: result.key_index,
  };
}

/**
 * Derive swap parameters at a specific index (for recovery).
 * This does NOT increment the derivation index.
 *
 * @param index - The derivation index to use
 * @returns Object containing ownSk (hex), ownPk (hex), preimage(hex), preimageHash (hex), userId (hex), and index
 */
export async function deriveSwapParamsAtIndex(
  index: number,
): Promise<SwapParams> {
  if (!wasmInitPromise) {
    throw new Error(
      "Browser wallet not initialized. Call initBrowserWallet() first.",
    );
  }

  const result = derive_swap_params_at_index(index);

  // Convert from WASM snake_case to JavaScript camelCase
  return {
    ownSk: result.own_sk,
    ownPk: result.own_pk,
    preimage: result.preimage,
    preimageHash: result.preimage_hash,
    userId: result.user_id,
    keyIndex: result.key_index,
  };
}

/**
 * Get the user_id Xpub for wallet recovery.
 * This Xpub can be sent to the server to recover all swaps.
 *
 * @returns The Xpub string, or null if no mnemonic is stored
 */
export async function getUserIdXpub(): Promise<string | null> {
  if (!wasmInitPromise) {
    throw new Error(
      "Browser wallet not initialized. Call initBrowserWallet() first.",
    );
  }

  return get_user_id_xpub();
}
