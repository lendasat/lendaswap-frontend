/**
 * Lightning Address Resolution Utility
 *
 * Converts Lightning addresses (user@domain.com) to BOLT11 invoices
 * using the LNURL-pay protocol (LUD-06).
 *
 * @see https://github.com/lnurl/luds/blob/luds/06.md
 * @see https://github.com/andrerfneves/lightning-address
 */

import { decode } from "@gandlaf21/bolt11-decode";
import type {
  LightningAddressError,
  LnUrlErrorResponse,
  LnUrlPayInvoiceResponse,
  LnUrlPayResponse,
  ParsedLightningAddress,
} from "./lightningAddressTypes";
import { LightningAddressError as LnAddressError } from "./lightningAddressTypes";

/**
 * Checks if a string is a valid Lightning address format
 * @param address - String to validate (e.g., "user@domain.com")
 * @returns true if valid Lightning address format
 */
export function isLightningAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;

  // Lightning address format: username@domain.tld
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(address);
}

/**
 * Checks if a string is a BOLT11 Lightning invoice
 * @param invoice - String to validate
 * @returns true if valid BOLT11 invoice format
 */
export function isBolt11Invoice(invoice: string): boolean {
  if (!invoice || typeof invoice !== "string") return false;

  // BOLT11 invoices start with ln + network prefix (bc, tb, bcrt)
  return /^ln(bc|tb|bcrt)[0-9][a-z0-9]+$/i.test(invoice);
}

/**
 * Parses a Lightning address into username and domain components
 * @param address - Lightning address (e.g., "user@speed.app")
 * @returns Parsed components
 * @throws {LightningAddressError} If address format is invalid
 */
export function parseLightningAddress(address: string): ParsedLightningAddress {
  if (!isLightningAddress(address)) {
    throw new LnAddressError(
      "Invalid Lightning address format. Expected format: user@domain.com",
      "INVALID_FORMAT",
    );
  }

  const [username, domain] = address.split("@");
  return { username, domain };
}

/**
 * Fetches LNURL-pay metadata from Lightning address
 *
 * @param address - Lightning address (e.g., "user@speed.app")
 * @returns LNURL-pay response with callback URL and amount limits
 * @throws {LightningAddressError} On network or service errors
 */
export async function fetchLnUrlPayMetadata(
  address: string,
): Promise<LnUrlPayResponse> {
  const { username, domain } = parseLightningAddress(address);

  // Construct LNURL-pay endpoint (LUD-16 spec)
  const url = `https://${domain}/.well-known/lnurlp/${username}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new LnAddressError(
        `LNURL service returned ${response.status}: ${response.statusText}`,
        "SERVICE_ERROR",
      );
    }

    const data = (await response.json()) as
      | LnUrlPayResponse
      | LnUrlErrorResponse;

    // Check for LNURL error response
    if ("status" in data && data.status === "ERROR") {
      throw new LnAddressError(
        `LNURL service error: ${data.reason}`,
        "SERVICE_ERROR",
      );
    }

    // Type narrow to LnUrlPayResponse after error check
    const payResponse = data as LnUrlPayResponse;

    // Validate response structure
    if (
      !payResponse ||
      payResponse.tag !== "payRequest" ||
      !payResponse.callback ||
      typeof payResponse.minSendable !== "number" ||
      typeof payResponse.maxSendable !== "number"
    ) {
      throw new LnAddressError(
        "Invalid LNURL-pay response structure",
        "SERVICE_ERROR",
      );
    }

    return payResponse;
  } catch (error) {
    if (error instanceof LnAddressError) {
      throw error;
    }

    // Network errors
    throw new LnAddressError(
      `Network error while fetching Lightning address: ${error instanceof Error ? error.message : "Unknown error"}`,
      "NETWORK_ERROR",
    );
  }
}

/**
 * Requests a BOLT11 invoice from LNURL callback
 *
 * @param callbackUrl - Callback URL from LNURL-pay metadata
 * @param amountMillisats - Amount in millisatoshis
 * @param comment - Optional comment (if supported by service)
 * @returns BOLT11 invoice string
 * @throws {LightningAddressError} On errors
 */
export async function fetchInvoiceFromCallback(
  callbackUrl: string,
  amountMillisats: number,
  comment?: string,
): Promise<string> {
  try {
    // Build callback URL with amount parameter
    const url = new URL(callbackUrl);
    url.searchParams.set("amount", amountMillisats.toString());

    if (comment) {
      url.searchParams.set("comment", comment);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new LnAddressError(
        `Callback request failed: ${response.status} ${response.statusText}`,
        "SERVICE_ERROR",
      );
    }

    const data = (await response.json()) as
      | LnUrlPayInvoiceResponse
      | LnUrlErrorResponse;

    // Check for error response
    if ("status" in data && data.status === "ERROR") {
      throw new LnAddressError(
        `Invoice generation failed: ${data.reason}`,
        "SERVICE_ERROR",
      );
    }

    // Validate response
    if (!data || !("pr" in data) || !data.pr) {
      throw new LnAddressError(
        "Invalid invoice response from callback",
        "SERVICE_ERROR",
      );
    }

    return data.pr;
  } catch (error) {
    if (error instanceof LnAddressError) {
      throw error;
    }

    throw new LnAddressError(
      `Error fetching invoice: ${error instanceof Error ? error.message : "Unknown error"}`,
      "NETWORK_ERROR",
    );
  }
}

/**
 * Validates a BOLT11 invoice matches expected amount
 *
 * @param invoice - BOLT11 invoice string
 * @param expectedMillisats - Expected amount in millisatoshis
 * @throws {LightningAddressError} If validation fails
 */
export function validateInvoiceAmount(
  invoice: string,
  expectedMillisats: number,
): void {
  try {
    const decoded = decode(invoice);

    // Find amount section
    let invoiceAmount = 0;
    for (const section of decoded.sections) {
      if (section.name === "amount" && section.value) {
        invoiceAmount = Number.parseInt(section.value, 10);
        break;
      }
    }

    // Compare amounts (allow small rounding differences)
    const tolerance = 1; // 1 millisat tolerance
    if (Math.abs(invoiceAmount - expectedMillisats) > tolerance) {
      throw new LnAddressError(
        `Invoice amount mismatch: expected ${expectedMillisats}, got ${invoiceAmount}`,
        "INVALID_INVOICE",
      );
    }
  } catch (error) {
    if (error instanceof LnAddressError) {
      throw error;
    }

    throw new LnAddressError(
      `Failed to decode invoice: ${error instanceof Error ? error.message : "Unknown error"}`,
      "INVALID_INVOICE",
    );
  }
}

/**
 * Resolves a Lightning address to a BOLT11 invoice
 *
 * Main entry point for converting Lightning addresses to invoices.
 * Handles the complete LNURL-pay flow:
 * 1. Parse Lightning address
 * 2. Fetch LNURL-pay metadata
 * 3. Validate amount is within limits
 * 4. Request invoice from callback
 * 5. Validate invoice
 *
 * @param address - Lightning address (e.g., "user@speed.app")
 * @param amountSats - Amount in satoshis
 * @param comment - Optional comment for payment
 * @returns BOLT11 invoice string
 * @throws {LightningAddressError} On any error in the flow
 *
 * @example
 * ```typescript
 * try {
 *   const invoice = await resolveLightningAddress("user@speed.app", 50000);
 *   console.log(invoice); // "lnbc500u1p3..."
 * } catch (error) {
 *   if (error instanceof LightningAddressError) {
 *     console.error(`Error: ${error.message} (${error.code})`);
 *   }
 * }
 * ```
 */
export async function resolveLightningAddress(
  address: string,
  amountSats: number,
  comment?: string,
): Promise<string> {
  // Convert sats to millisats
  const amountMillisats = amountSats * 1000;

  // Step 1: Fetch LNURL-pay metadata
  const metadata = await fetchLnUrlPayMetadata(address);

  // Step 2: Validate amount is within limits
  if (amountMillisats < metadata.minSendable) {
    throw new LnAddressError(
      `Amount ${amountSats} sats is below minimum ${metadata.minSendable / 1000} sats`,
      "AMOUNT_OUT_OF_RANGE",
    );
  }

  if (amountMillisats > metadata.maxSendable) {
    throw new LnAddressError(
      `Amount ${amountSats} sats exceeds maximum ${metadata.maxSendable / 1000} sats`,
      "AMOUNT_OUT_OF_RANGE",
    );
  }

  // Step 3: Request invoice from callback
  const invoice = await fetchInvoiceFromCallback(
    metadata.callback,
    amountMillisats,
    comment,
  );

  // Step 4: Validate invoice
  if (!isBolt11Invoice(invoice)) {
    throw new LnAddressError(
      "Received invalid BOLT11 invoice format",
      "INVALID_INVOICE",
    );
  }

  // Validate invoice amount matches request
  validateInvoiceAmount(invoice, amountMillisats);

  return invoice;
}

/**
 * Utility to get human-readable error message
 * @param error - LightningAddressError instance
 * @returns User-friendly error message
 */
export function getLightningAddressErrorMessage(
  error: LightningAddressError,
): string {
  switch (error.code) {
    case "INVALID_FORMAT":
      return "Invalid Lightning address format. Please use format: user@domain.com";
    case "NETWORK_ERROR":
      return "Network error. Please check your connection and try again.";
    case "SERVICE_ERROR":
      return "Lightning address service error. Please try again later.";
    case "AMOUNT_OUT_OF_RANGE":
      return error.message;
    case "INVALID_INVOICE":
      return "Received invalid invoice. Please contact support.";
    default:
      return "Unknown error resolving Lightning address.";
  }
}
