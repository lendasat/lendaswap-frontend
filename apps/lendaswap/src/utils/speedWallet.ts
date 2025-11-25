/**
 * Speed Wallet Integration Utilities
 *
 * Speed Wallet is a Bitcoin wallet that supports Mini Apps.
 * When LendaSwap runs inside Speed Wallet, we use their payment API
 * instead of displaying QR codes.
 *
 * @see https://docs.speed.app/mini-apps/receiving-payments
 */

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
 * Detects if LendaSwap is running inside Speed Wallet's Mini App environment.
 *
 * Speed Wallet loads Mini Apps in an iframe/webview and exposes
 * message handlers for iOS, Android, and web.
 */
export const isSpeedWalletEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;

  return !!(
    window.Android ||
    window.webkit?.messageHandlers?.iosInterface ||
    (window.parent && window.parent !== window)
  );
};

/**
 * Gets the Speed Wallet account ID from the URL parameters.
 * Speed passes the account_id in the Mini App URL.
 */
export const getSpeedAccountId = (): string | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  return params.get("account_id");
};

/**
 * Gets the user's Lightning address from Speed Wallet URL parameters.
 * Speed passes the user's LN address when launching Mini Apps.
 *
 * @returns Lightning address (e.g., "user@speed.app") or null if not available
 */
export const getSpeedLightningAddress = (): string | null => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  // Try multiple possible parameter names
  return (
    params.get("ln_address") ||
    params.get("lightning_address") ||
    params.get("lnAddress") ||
    null
  );
};

/**
 * Checks if we have a valid Speed Wallet context (inside Speed + has account_id)
 */
export const isValidSpeedWalletContext = (): boolean => {
  return isSpeedWalletEnvironment() && getSpeedAccountId() !== null;
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
