import type { SwapResponse } from "../api";

export const isDebugMode = () => import.meta.env.VITE_DEBUG_MODE === "true";

export const DEBUG_SWAP_ID = "debug-swap-123";

// Mock swap data for debug mode - all values are placeholders for UI testing only
export const mockSwapData: SwapResponse = {
  id: DEBUG_SWAP_ID,
  ln_invoice: "DEBUG_MODE_INVOICE",
  arkade_address: "DEBUG_MODE_ADDRESS",
  sats_required: 0,
  usd_amount: 0,
  usd_per_sat: 0,
  hash_lock: "0x0",
};

export const mockPolygonAddress = "0x0000000000000000000000000000000000000000";
export const mockTxId =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
