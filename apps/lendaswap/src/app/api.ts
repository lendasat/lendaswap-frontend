import {getReferralCode} from "./utils/referralCode";

// API client for Lendaswap backend
const API_BASE_URL =
  import.meta.env.VITE_LENDASWAP_API_URL || "http://localhost:3333";

// WebSocket URL (replace http with ws)
const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

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

export interface AssetPair {
  source: TokenId;
  target: TokenId;
}

export interface PriceResponse {
  usd_per_btc: number;
}

// WebSocket price feed types (matching backend message format)
export interface PriceTiers {
  usd_1: number;
  usd_100: number;
  usd_1000: number;
  usd_5000: number;
}

export interface TradingPairPrices {
  pair: string; // e.g., "USDC_POL-BTC" or "USDT_POL-BTC"
  tiers: PriceTiers;
}

export interface PriceUpdateMessage {
  timestamp: number;
  pairs: TradingPairPrices[];
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
  | "expired" // Swap expired before client funded (terminal)
  | "clientinvalidfunded" // Client funded wrong and needs to refund
  | "clientfundedtoolate"; // Client funded to late and needs to refund

export interface SwapRequest {
  target_address: string;
  target_amount: number;
  target_token: TokenId; // Token to receive (e.g., USDC_POL, USDT_POL)
  hash_lock: string;
  refund_pk: string;
  referral_code?: string; // Optional referral code for tracking
}


export function getTokenSymbol(tokenId: TokenId): string {
  switch (tokenId) {
    case "usdc_pol":
      return "USDC";
    case "usdt_pol":
      return "USDT";
    case "btc_arkade":
      return "BTC";
    case "btc_lightning":
      return "BTC";
    default:
      return "USDC";
  }
}

export interface SwapResponse {
  id: string;
  ln_invoice: string;
  htlc_address_arkade: string;
  sats_required: number;
  fee_sats?: number; // Optional - not displayed in UI
  usd_amount: number;
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
  created_at: string;
  source_token: TokenId;
  target_token: TokenId;
}

export interface GetSwapResponse {
  id: string;
  status: SwapStatus;
  htlc_address_arkade: string;
  ln_invoice: string;
  sats_required: number;
  sats_received: number | null;
  usd_amount: number;
  bitcoin_htlc_claim_txid: string | null;
  bitcoin_htlc_fund_txid: string | null;
  polygon_htlc_claim_txid: string | null;
  polygon_htlc_fund_txid: string | null;
  hash_lock: string;
  htlc_address_polygon: string;
  user_address_polygon: string;
  user_address_arkade: string;
  onchain_swap_id: string | null; // The actual on-chain swap ID used by the HTLC contract
  fee_sats?: number; // Optional fee in satoshis
  // VHTLC parameters for refunding
  sender_pk: string;
  receiver_pk: string;
  server_pk: string;
  refund_locktime: number;
  unilateral_claim_delay: number;
  unilateral_refund_delay: number;
  unilateral_refund_without_receiver_delay: number;
  network: string;
  // Polygon → Arkade swap specific fields (matches CreateSwapResponse naming)
  create_swap_tx?: string;
  approve_tx?: string;
  gelato_forwarder_address?: string;
  gelato_user_nonce?: string;
  gelato_user_deadline?: string;
  sats_receive?: number; // For Polygon → Arkade: net sats user will receive
  source_token_address?: string; // ERC20 token address for approve target
  created_at: string;
  source_token: TokenId;
  target_token: TokenId;
}

// Polygon → Arkade swap types
export interface PolygonToArkadeSwapRequest {
  target_address: string;
  source_amount: number;
  source_token: TokenId;
  hash_lock: string;
  receiver_pk: string;
  user_polygon_address: string;
  referral_code?: string;
  user_polygon_address_nonce: number;
}

export interface PolygonToArkadeSwapResponse {
  id: string;
  htlc_address_polygon: string;
  htlc_address_arkade: string;
  approve_tx?: string;
  create_swap_tx: string;
  sats_receive: number;
  fee_sats: number;
  usd_amount: number;
  hash_lock: string;
  sender_pk: string;
  receiver_pk: string;
  server_pk: string;
  refund_locktime: number;
  unilateral_claim_delay: number;
  unilateral_refund_delay: number;
  unilateral_refund_without_receiver_delay: number;
  network: string;
  // Gelato signing parameters
  gelato_forwarder_address: string;
  gelato_user_deadline: string;
  source_token_address?: string;
  created_at: string;
  source_token: TokenId;
  target_token: TokenId;
}

export interface GelatoSubmitRequest {
  create_swap_signature: string;
  user_nonce: string;
  user_deadline: string;
}

export interface GelatoSubmitResponse {
  create_swap_task_id: string;
  message: string;
}

export const api = {
  async getTokens(): Promise<TokenInfo[]> {
    const response = await fetch(`${API_BASE_URL}/tokens`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.statusText}`);
    }
    return response.json();
  },

  async getAssetPairs(): Promise<AssetPair[]> {
    const response = await fetch(`${API_BASE_URL}/asset-pairs`);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset pairs: ${response.statusText}`);
    }
    return response.json();
  },

  async createArkadeToPolygonSwap(request: SwapRequest): Promise<SwapResponse> {
    // Automatically include referral code from localStorage if present
    const referralCode = getReferralCode();
    const requestWithReferral = {
      ...request,
      ...(referralCode ? {referral_code: referralCode} : {}),
    };

    const response = await fetch(`${API_BASE_URL}/swap/arkade/polygon`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestWithReferral),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({error: response.statusText}));
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
      body: JSON.stringify({secret}),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({error: response.statusText}));
      throw new Error(error.error || `Failed to claim: ${response.statusText}`);
    }
  },

  async createPolygonToArkadeSwap(
    request: PolygonToArkadeSwapRequest,
  ): Promise<PolygonToArkadeSwapResponse> {
    const referralCode = getReferralCode();
    const requestWithReferral = {
      ...request,
      ...(referralCode ? {referral_code: referralCode} : {}),
    };

    const response = await fetch(`${API_BASE_URL}/swap/polygon/arkade`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(requestWithReferral),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({error: response.statusText}));
      throw new Error(
        error.error || `Failed to create swap: ${response.statusText}`,
      );
    }

    return response.json();
  },

  async submitToGelato(
    swapId: string,
    request: GelatoSubmitRequest,
  ): Promise<GelatoSubmitResponse> {
    const response = await fetch(
      `${API_BASE_URL}/swap/${swapId}/gelato-submit`,
      {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({error: response.statusText}));
      throw new Error(
        error.error || `Failed to submit to Gelato: ${response.statusText}`,
      );
    }

    return response.json();
  },
};

/**
 * WebSocket price feed service
 * Manages connection to /ws/prices endpoint with auto-reconnect
 */
export class PriceFeedService {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private listeners: Set<(update: PriceUpdateMessage) => void> = new Set();
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private isManualClose = false;

  /**
   * Subscribe to price updates
   * @param callback Function to call when prices are updated
   * @returns Unsubscribe function
   */
  subscribe(callback: (update: PriceUpdateMessage) => void): () => void {
    this.listeners.add(callback);

    // Connect if not already connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      // Close connection if no more listeners
      if (this.listeners.size === 0) {
        this.close();
      }
    };
  }

  /**
   * Connect to WebSocket price feed
   */
  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isManualClose = false;

    try {
      this.ws = new WebSocket(`${WS_BASE_URL}/ws/prices`);

      this.ws.onopen = () => {
        console.log("Price feed WebSocket connected");
        // Reset reconnect delay on successful connection
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const update: PriceUpdateMessage = JSON.parse(event.data);
          // Notify all listeners
          this.listeners.forEach((callback) => callback(update));
        } catch (error) {
          console.error("Failed to parse price update:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Price feed WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("Price feed WebSocket closed");
        this.ws = null;

        // Only reconnect if we have listeners and it wasn't a manual close
        if (this.listeners.size > 0 && !this.isManualClose) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      if (this.listeners.size > 0 && !this.isManualClose) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return;
    }

    console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      // Exponential backoff
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay,
      );
    }, this.reconnectDelay);
  }

  /**
   * Close WebSocket connection
   */
  private close(): void {
    this.isManualClose = true;

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
export const priceFeedService = new PriceFeedService();
