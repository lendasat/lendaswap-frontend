import init, {
  refund_vhtlc,
  amounts_for_swap,
  type VhtlcAmounts as WasmVhtlcAmounts,
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
