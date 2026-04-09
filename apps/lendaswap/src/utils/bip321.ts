/**
 * URI parser for Bitcoin (BIP-21), Lightning, and Ark URI schemes.
 *
 * Supports:
 *   bitcoin:<address>?amount=<BTC>&label=...&message=...&lightning=<invoice>&ark=<address>
 *   lightning:<invoice-or-lnurl>
 *   ark:<address>?amount=<BTC>&...
 *
 * The unified bitcoin: format can carry lightning and ark addresses as query params.
 *
 * @see https://github.com/bitcoin/bips/blob/master/bip-0021.mediawiki
 */

export type UriScheme = "bitcoin" | "lightning" | "ark";

export interface ParsedUri {
  scheme: UriScheme;
  address: string;
  /** Amount in BTC (not satoshis) */
  amount?: number;
  label?: string;
  message?: string;
  /** Lightning invoice or LNURL embedded in a bitcoin: URI */
  lightning?: string;
  /** Ark address embedded in a bitcoin: URI */
  ark?: string;
  /** Any additional/unknown query parameters */
  otherParams?: Record<string, string>;
}

const URI_REGEX = /^(bitcoin|lightning|ark):([^?]*)(\?.*)?$/i;

/**
 * Check if a string is a supported URI (bitcoin:, lightning:, or ark:)
 */
export function isSupportedUri(input: string): boolean {
  return URI_REGEX.test(input.trim());
}

/**
 * Parse a bitcoin:, lightning:, or ark: URI into its components.
 * Throws if the URI is malformed or uses an unsupported scheme.
 */
export function parseUri(input: string): ParsedUri {
  const trimmed = input.trim();
  const match = URI_REGEX.exec(trimmed);
  if (!match) {
    throw new Error("Not a valid bitcoin:, lightning:, or ark: URI");
  }

  const scheme = match[1].toLowerCase() as UriScheme;
  const address = match[2];
  const queryString = match[3]; // includes '?'

  if (!address) {
    throw new Error(`Missing address in ${scheme}: URI`);
  }

  const result: ParsedUri = { scheme, address };

  if (queryString) {
    const params = new URLSearchParams(queryString.slice(1));

    const amount = params.get("amount");
    if (amount !== null) {
      const parsed = Number.parseFloat(amount);
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error(`Invalid amount in ${scheme}: URI`);
      }
      result.amount = parsed;
      params.delete("amount");
    }

    const label = params.get("label");
    if (label !== null) {
      result.label = label;
      params.delete("label");
    }

    const message = params.get("message");
    if (message !== null) {
      result.message = message;
      params.delete("message");
    }

    // Extract embedded lightning and ark addresses (unified bitcoin: URI)
    const lightning = params.get("lightning");
    if (lightning !== null) {
      result.lightning = lightning;
      params.delete("lightning");
    }

    const ark = params.get("ark");
    if (ark !== null) {
      result.ark = ark;
      params.delete("ark");
    }

    // Collect remaining params
    const other: Record<string, string> = {};
    for (const [key, val] of params.entries()) {
      other[key] = val;
    }
    if (Object.keys(other).length > 0) {
      result.otherParams = other;
    }
  }

  return result;
}
