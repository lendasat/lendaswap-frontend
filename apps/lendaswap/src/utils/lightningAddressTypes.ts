/**
 * Type definitions for Lightning Address / LNURL-pay protocol
 * @see https://github.com/lnurl/luds/blob/luds/06.md
 */

/**
 * Initial response from LNURL-pay endpoint
 */
export interface LnUrlPayResponse {
  tag: "payRequest";
  callback: string; // URL to request invoice
  minSendable: number; // Minimum millisatoshis
  maxSendable: number; // Maximum millisatoshis
  metadata: string; // JSON stringified array
  commentAllowed?: number; // Max comment length
}

/**
 * Response from callback URL with invoice
 */
export interface LnUrlPayInvoiceResponse {
  pr: string; // BOLT11 invoice (bech32 encoded)
  routes?: unknown[]; // Payment routes (typically empty)
  successAction?: {
    tag: string;
    message?: string;
    url?: string;
    description?: string;
  };
  disposable?: boolean;
}

/**
 * Error response from LNURL service
 */
export interface LnUrlErrorResponse {
  status: "ERROR";
  reason: string;
}

/**
 * Parsed Lightning address components
 */
export interface ParsedLightningAddress {
  username: string;
  domain: string;
}

/**
 * Custom error types for Lightning address resolution
 */
export class LightningAddressError extends Error {
  constructor(
    message: string,
    public code:
      | "INVALID_FORMAT"
      | "NETWORK_ERROR"
      | "SERVICE_ERROR"
      | "AMOUNT_OUT_OF_RANGE"
      | "INVALID_INVOICE",
  ) {
    super(message);
    this.name = "LightningAddressError";
  }
}
