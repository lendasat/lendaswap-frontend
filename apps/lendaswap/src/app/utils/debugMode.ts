import type { SwapResponse } from "../api";

export const isDebugMode = () => import.meta.env.VITE_DEBUG_MODE === "true";

export const DEBUG_SWAP_ID = "debug-swap-123";

// Mock swap data for debug mode - all values are placeholders for UI testing only
export const mockSwapData: SwapResponse = {
  created_at: new Date().toString(),
  network: "bitcoin",
  receiver_pk: "DEBUG_MODE_PK",
  refund_locktime: 0,
  sender_pk: "DEBUG_MODE_PK",
  server_pk: "DEBUG_MODE_PK",
  source_token: "btc_arkade",
  target_token: "usdc_pol",
  unilateral_claim_delay: 0,
  unilateral_refund_delay: 0,
  unilateral_refund_without_receiver_delay: 0,
  id: DEBUG_SWAP_ID,
  ln_invoice: "DEBUG_MODE_INVOICE",
  htlc_address_arkade: "DEBUG_MODE_ADDRESS",
  sats_required: 0,
  usd_amount: 0,
  hash_lock: "0x0",
};

export const mockPolygonAddress = "0x0000000000000000000000000000000000000000";
export const mockTxId =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
