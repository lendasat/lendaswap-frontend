import { getReferralCode } from "./utils/referralCode";

// API client for Lendaswap backend
const API_BASE_URL =
  import.meta.env.VITE_LENDASWAP_API_URL || "http://localhost:3333";

// Token types
export type TokenId = "btc_lightning" | "btc_arkade" | "usdc_pol" | "usdt_pol";

export type Chain = "Bitcoin" | "Polygon";

export interface TokenInfo {
  token_id: TokenId;
  symbol: string;
  chain: Chain;
  name: string;
  decimals: number;
}

export interface PriceResponse {
  usd_per_sat: number;
  usd_per_btc: number;
}

/**
 * Atomic swap state machine for BTC --> Token swaps using HTLCs.
 *
 * Normal flow:
 *   pending → clientfunded → serverfunded → clientredeemed → serverredeemed
 *
 * Refund flows:
 *   pending → expired (no funding)
 *   clientfunded → clientrefunded (before server funds)
 *   serverfunded → clientfundedserverrefunded (HTLC timeout)
 */
export type SwapStatus =
  | "pending" // Initial state, waiting for client to fund BTC
  | "clientfunded" // Client funded BTC, waiting for server to create HTLC
  | "clientrefunded" // Client refunded before server created HTLC (terminal)
  | "serverfunded" // Server locked WBTC in HTLC, waiting for client to claim
  | "clientredeemed" // Client claimed token by revealing secret
  | "serverredeemed" // Server claimed BTC using revealed secret (success - terminal)
  | "clientfundedserverrefunded" // HTLC timed out, both refunded (terminal)
  | "clientrefundedserverfunded" // ERROR: Client refunded while server locked (should never happen)
  | "clientrefundedserverrefunded" // Both refunded after error state (terminal)
  | "expired"; // Swap expired before client funded (terminal)

export interface SwapRequest {
  polygon_address: string;
  refund_pk: string;
  hash_lock: string;
  usd_amount: number;
  target_token: TokenId; // Token to receive (e.g., USDC_POL, USDT_POL)
  referral_code?: string; // Optional referral code for tracking
}

export interface SwapResponse {
  id: string;
  ln_invoice: string;
  arkade_address: string;
  sats_required: number;
  fee_sats?: number; // Optional - not displayed in UI
  usd_amount: number;
  usd_per_sat: number;
  hash_lock: string;
  // VHTLC parameters for refunding
  sender_pk: string;
  receiver_pk: string;
  server_pk: string;
  refund_locktime: number;
  unilateral_claim_delay: number;
  unilateral_refund_delay: number;
  unilateral_refund_without_receiver_delay: number;
  network: string;
}

export interface GetSwapResponse {
  id: string;
  status: SwapStatus;
  arkade_address: string;
  ln_invoice: string;
  sats_required: number;
  sats_received: number | null;
  usd_amount: number;
  usd_per_sat: number;
  bitcoin_htlc_claim_txid: string | null;
  bitcoin_htlc_fund_txid: string | null;
  polygon_htlc_claim_txid: string | null;
  polygon_htlc_fund_txid: string | null;
  hash_lock: string;
  polygon_address: string;
  onchain_swap_id: string | null; // The actual on-chain swap ID used by the HTLC contract
  fee_sats?: number; // Optional fee in satoshis
  target_token: TokenId; // The token being received
  // VHTLC parameters for refunding
  sender_pk: string;
  receiver_pk: string;
  server_pk: string;
  refund_locktime: number;
  unilateral_claim_delay: number;
  unilateral_refund_delay: number;
  unilateral_refund_without_receiver_delay: number;
  network: string;
}

export const api = {
  async getPrice(): Promise<PriceResponse> {
    const response = await fetch(`${API_BASE_URL}/price`);
    if (!response.ok) {
      throw new Error(`Failed to fetch price: ${response.statusText}`);
    }
    return response.json();
  },

  async getTokens(): Promise<TokenInfo[]> {
    const response = await fetch(`${API_BASE_URL}/tokens`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.statusText}`);
    }
    return response.json();
  },

  async createSwap(request: SwapRequest): Promise<SwapResponse> {
    // Automatically include referral code from localStorage if present
    const referralCode = getReferralCode();
    const requestWithReferral = {
      ...request,
      ...(referralCode ? { referral_code: referralCode } : {}),
    };

    const response = await fetch(`${API_BASE_URL}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestWithReferral),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(
        error.error || `Failed to create swap: ${response.statusText}`,
      );
    }
    return response.json();
  },

  async healthCheck(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.text();
  },

  async getSwap(id: string): Promise<GetSwapResponse> {
    const response = await fetch(`${API_BASE_URL}/swap/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch swap: ${response.statusText}`);
    }
    return response.json();
  },

  async claimGelato(id: string, secret: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/swap/${id}/claim-gelato`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ secret }),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Failed to claim: ${response.statusText}`);
    }
  },
};
