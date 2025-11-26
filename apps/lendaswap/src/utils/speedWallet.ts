/**
 * Speed Wallet Integration Utilities
 *
 * Speed Wallet is a Bitcoin wallet that supports Mini Apps.
 * When LendaSwap runs inside Speed Wallet, we use their payment API
 * instead of displaying QR codes.
 *
 * @see https://docs.speed.app/mini-apps/receiving-payments
 *
 * URL Parameters passed by Speed Wallet:
 * - acct: Account ID (e.g., "acct_li8hh2xyRuSBWnE4")
 * - lang: Language preference (e.g., "en", "es", "de", "hi")
 * - bal_btc: Bitcoin balance in Satoshis (1 BTC = 100,000,000 SATs)
 * - bal_usdt: USDT balance in standard units
 * - p_add: Lightning address (e.g., "user@speed.app")
 *
 * Example URL:
 * https://app.com?acct=acct_li8hh2xyRuSBWnE4&lang=en&bal_btc=87636&bal_usdt=1975.29&p_add=abc%40speed.app
 */

export interface SpeedWalletParams {
  /** Account ID (e.g., "acct_li8hh2xyRuSBWnE4") */
  accountId: string | null;
  /** Language preference (e.g., "en", "es", "de", "hi") */
  language: string | null;
  /** Bitcoin balance in Satoshis */
  balanceBtcSats: number | null;
  /** USDT balance in standard units */
  balanceUsdt: number | null;
  /** Lightning address (e.g., "user@speed.app") */
  lightningAddress: string | null;
}

export interface SpeedWalletPaymentRequest {
  version: "2022-10-15";
  account_id: string;
  data: {
    amount: number;
    currency: "SATS" | "USD" | "EUR" | "BTC";
    target_currency: "SATS" | "USDT";
    deposit_address: string; // LN invoice, LN address, LNURL, or BTC/USDT address
    note?: string;
  };
}

/**
 * Parses all Speed Wallet parameters from the URL.
 * Call this once on app initialization and store the result.
 */
export const getSpeedWalletParams = (): SpeedWalletParams => {
  if (typeof window === "undefined") {
    return {
      accountId: null,
      language: null,
      balanceBtcSats: null,
      balanceUsdt: null,
      lightningAddress: null,
    };
  }

  const params = new URLSearchParams(window.location.search);

  const balBtcRaw = params.get("bal_btc");
  const balUsdtRaw = params.get("bal_usdt");
  const pAdd = params.get("p_add");

  return {
    accountId: params.get("acct"),
    language: params.get("lang"),
    balanceBtcSats: balBtcRaw ? parseInt(balBtcRaw, 10) : null,
    balanceUsdt: balUsdtRaw ? parseFloat(balUsdtRaw) : null,
    lightningAddress: pAdd ? decodeURIComponent(pAdd) : null,
  };
};

/**
 * Detects if LendaSwap is running inside Speed Wallet's Mini App environment.
 * Checks for Speed Wallet URL parameters (acct with "acct_" prefix).
 */
export const isSpeedWalletEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const acct = params.get("acct");

  // Check for Speed Wallet account ID (starts with "acct_")
  if (acct?.startsWith("acct_")) {
    return true;
  }

  // Fallback: check for native message handlers
  return !!(
    window.Android ||
    window.webkit?.messageHandlers?.iosInterface ||
    (window.parent && window.parent !== window)
  );
};

/**
 * Gets the Speed Wallet account ID from the URL parameters.
 * @returns Account ID (e.g., "acct_li8hh2xyRuSBWnE4") or null
 */
export const getSpeedAccountId = (): string | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  return params.get("acct");
};

/**
 * Gets the user's Lightning address from Speed Wallet URL parameters.
 * @returns Lightning address (e.g., "user@speed.app") or null
 */
export const getSpeedLightningAddress = (): string | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const pAdd = params.get("p_add");
  return pAdd ? decodeURIComponent(pAdd) : null;
};

/**
 * Gets the user's Bitcoin balance in Satoshis from Speed Wallet URL parameters.
 * @returns Balance in Satoshis or null
 */
export const getSpeedBalanceBtc = (): number | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const balBtc = params.get("bal_btc");
  return balBtc ? parseInt(balBtc, 10) : null;
};

/**
 * Gets the user's USDT balance from Speed Wallet URL parameters.
 * @returns USDT balance or null
 */
export const getSpeedBalanceUsdt = (): number | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const balUsdt = params.get("bal_usdt");
  return balUsdt ? parseFloat(balUsdt) : null;
};

/**
 * Gets the user's language preference from Speed Wallet URL parameters.
 * @returns Language code (e.g., "en", "es", "de") or null
 */
export const getSpeedLanguage = (): string | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  return params.get("lang");
};

/**
 * Checks if we have a valid Speed Wallet context (has account_id with correct prefix)
 */
export const isValidSpeedWalletContext = (): boolean => {
  const accountId = getSpeedAccountId();
  return accountId !== null && accountId.startsWith("acct_");
};

/**
 * Triggers a payment request via Speed Wallet's native payment UI.
 *
 * This sends a JSON payload to Speed Wallet which then:
 * 1. Shows the user a native payment confirmation screen
 * 2. Processes the payment through Speed Wallet
 * 3. Sends funds to the specified deposit_address (our LN invoice)
 *
 * @param lightningInvoice - The BOLT11 Lightning invoice to pay
 * @param satsAmount - Amount in satoshis
 * @param note - Optional payment note/description
 * @returns true if the message was sent, false if not in Speed Wallet environment
 */
export const triggerSpeedWalletPayment = (
  lightningInvoice: string,
  satsAmount: number,
  note?: string,
): boolean => {
  const accountId = getSpeedAccountId();

  if (!accountId) {
    console.warn(
      "Speed Wallet payment triggered but no account_id found in URL",
    );
    return false;
  }

  const paymentRequest: SpeedWalletPaymentRequest = {
    version: "2022-10-15",
    account_id: accountId,
    data: {
      amount: satsAmount,
      currency: "SATS",
      target_currency: "SATS",
      deposit_address: lightningInvoice,
      note: note,
    },
  };

  const data = JSON.stringify(paymentRequest);

  // Speed Wallet's required payment bridge
  // Priority: Android > iOS > Web (parent iframe) > fallback
  if (window.Android) {
    window.Android.postMessage(data);
  } else if (window.webkit?.messageHandlers?.iosInterface) {
    window.webkit.messageHandlers.iosInterface.postMessage(data);
  } else if (window.parent && window.parent !== window) {
    window.parent.postMessage(data, "*");
  } else {
    window.postMessage(data, "*");
  }

  return true;
};
