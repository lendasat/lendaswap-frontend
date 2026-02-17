import { CheckCheck, Copy, Loader2, QrCode, Wallet, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import {
  isValidSpeedWalletContext,
  triggerSpeedWalletPayment,
} from "../../../utils/speedWallet";
import { getTokenNetworkName } from "../../api";
import { getTokenIcon, getTokenNetworkIcon } from "../../utils/tokenUtils";
import { useWalletBridge } from "../../WalletBridgeContext";
import type { LightningToEvmSwapResponse } from "@lendasat/lendaswap-sdk-pure";

interface SendLightningStepProps {
  swapData: LightningToEvmSwapResponse;
}

export function SendLightningStep({ swapData }: SendLightningStepProps) {
  const navigate = useNavigate();
  const { client, isEmbedded, isReady } = useWalletBridge();
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [speedPaymentTriggered, setSpeedPaymentTriggered] = useState(false);

  const lightningInvoice = swapData.boltz_invoice;
  const lightningQrValue = `lightning:${lightningInvoice}`;
  const swapId = swapData.id;
  const tokenAmount = swapData.target_amount.toString();
  const tokenSymbol = swapData.target_token.symbol;

  // Check if we're running inside Speed Wallet
  const isSpeedWallet = isValidSpeedWalletContext();

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const shortenAddress = (address: string, startChars = 12, endChars = 12) => {
    if (address.length <= startChars + endChars) {
      return address;
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  };

  const handleSendFromWallet = async () => {
    if (!client || !swapData || !swapId) {
      return;
    }

    try {
      setIsSending(true);
      setSendError(null);

      // Send Bitcoin using the wallet bridge
      await client.sendToAddress(
        lightningInvoice,
        swapData.source_amount,
        "bitcoin",
      );

      // We stay on wizard - polling will detect status change and update UI
    } catch (error) {
      console.error("Failed to send from wallet:", error);
      setSendError(
        error instanceof Error ? error.message : "Failed to send from wallet",
      );
      setIsSending(false);
    }
  };

  const handleSpeedWalletPayment = () => {
    if (!lightningInvoice || !swapData) {
      setSendError("Payment details not available");
      return;
    }

    const success = triggerSpeedWalletPayment(
      lightningInvoice,
      swapData.source_amount,
      `LendaSwap: ${tokenAmount} ${tokenSymbol} swap`,
    );

    if (success) {
      setSpeedPaymentTriggered(true);
      setSendError(null);
    } else {
      setSendError("Failed to trigger Speed Wallet payment");
    }
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-muted border border-border">
              <div className="w-5 h-5 flex items-center justify-center">
                {getTokenIcon(swapData.source_token)}
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background p-[1px] flex items-center justify-center">
              <div className="w-full h-full rounded-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full">
                {getTokenNetworkIcon(swapData.source_token)}
              </div>
            </div>
          </div>
          <h3 className="text-sm font-semibold">
            {isSpeedWallet ? "Pay with Speed Wallet" : "Send BTC"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono text-muted-foreground">
            {swapId.slice(0, 8)}…
          </code>
          <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-5 p-5">
        {/* Speed Wallet Mode: Simplified UI */}
        {isSpeedWallet && (
          <p className="text-sm text-muted-foreground text-center">
            Tap the button below to complete your payment
          </p>
        )}

        {/* Standard Mode: QR Code - Hidden on mobile by default, always visible on desktop */}
        {!isSpeedWallet && lightningInvoice && (
          <>
            {/* Toggle button - only visible on mobile */}
            <div className="md:hidden">
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => setShowQrCode(!showQrCode)}
              >
                <QrCode className="mr-2 h-5 w-5" />
                {showQrCode ? "Hide QR Code" : "Show QR Code"}
              </Button>
            </div>

            {/* QR Code display */}
            <div
              className={`flex flex-col items-center space-y-4 ${showQrCode ? "block" : "hidden"} md:flex`}
            >
              <div className="rounded-lg bg-white p-1">
                <QRCodeSVG value={lightningQrValue} size={200} level="M" />
              </div>
            </div>
          </>
        )}

        {/* Standard Mode: Lightning Address */}
        {!isSpeedWallet && (
          <div className="w-full space-y-2">
            <div className="text-muted-foreground text-sm font-medium">
              Lightning Invoice
            </div>
            <div className="flex items-center gap-2">
              <div className="dark:bg-muted/50 border-border flex-1 rounded-lg border bg-white p-3 font-mono text-xs">
                {lightningInvoice ? (
                  <>
                    {/* Show shortened on mobile, full on desktop */}
                    <span className="md:hidden">
                      {shortenAddress(lightningInvoice)}
                    </span>
                    <span className="hidden md:inline break-all">
                      {lightningInvoice}
                    </span>
                  </>
                ) : (
                  "N/A"
                )}
              </div>
              {lightningInvoice && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyAddress(lightningInvoice)}
                  className="shrink-0"
                >
                  {copiedAddress === lightningInvoice ? (
                    <CheckCheck className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Amount Reminder */}
        <div className="bg-muted/50 space-y-2 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You Receive</span>
            <span className="font-medium">
              {tokenAmount} {tokenSymbol} on{" "}
              {getTokenNetworkName(swapData.target_token)}
            </span>
          </div>
        </div>

        {/* Send Error */}
        {sendError && (
          <div className="rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20">
            {sendError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {/* Speed Wallet Payment Button */}
          {isSpeedWallet && (
            <Button
              className="h-14 w-full text-base font-semibold"
              onClick={handleSpeedWalletPayment}
              disabled={speedPaymentTriggered}
            >
              {speedPaymentTriggered ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Waiting for payment...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  Pay {swapData?.source_amount.toLocaleString()} sats
                </>
              )}
            </Button>
          )}

          {/* Send from wallet - only on embedded wallets (non-Speed) - First on mobile, second on desktop */}
          {!isSpeedWallet && isEmbedded && isReady && client && (
            <Button
              variant="outline"
              className="h-12 w-full text-base font-semibold order-first md:order-2"
              onClick={handleSendFromWallet}
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-5 w-5" />
                  Send from Wallet
                </>
              )}
            </Button>
          )}

          {/* Waiting for payment - Standard mode only */}
          {!isSpeedWallet && (
            <Button
              className="h-12 w-full text-base font-semibold order-2 md:order-first"
              disabled={true}
            >
              Waiting for payment
            </Button>
          )}

          {/* Back/Cancel button - Always last */}
          <Button
            variant="outline"
            className="h-12 w-full order-last"
            onClick={() => navigate("/")}
          >
            Cancel Swap
          </Button>
        </div>
      </div>
    </div>
  );
}
