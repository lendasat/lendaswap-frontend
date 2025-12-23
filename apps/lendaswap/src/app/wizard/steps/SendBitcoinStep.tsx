import { CheckCheck, Copy, Loader2, QrCode, Wallet, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import {
  isValidSpeedWalletContext,
  triggerSpeedWalletPayment,
} from "../../../utils/speedWallet";
import { type BtcToEvmSwapResponse, getTokenNetworkName } from "../../api";
import { useWalletBridge } from "../../WalletBridgeContext";

interface SendBitcoinStepProps {
  arkadeAddress: string | null;
  lightningAddress: string | null;
  unifiedAddress: string;
  swapData: BtcToEvmSwapResponse;
  tokenAmount: string;
  tokenSymbol?: string; // e.g., "USDC", "USDT"
  swapId: string;
}

export function SendBitcoinStep({
  arkadeAddress,
  lightningAddress,
  unifiedAddress,
  swapData,
  tokenAmount,
  tokenSymbol = "USDC",
  swapId,
}: SendBitcoinStepProps) {
  const navigate = useNavigate();
  const { client, isEmbedded, isReady } = useWalletBridge();
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [speedPaymentTriggered, setSpeedPaymentTriggered] = useState(false);

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
    if (!client || !arkadeAddress || !swapData || !swapId) {
      return;
    }

    try {
      setIsSending(true);
      setSendError(null);

      // Send Bitcoin using the wallet bridge
      await client.sendToAddress(
        arkadeAddress,
        Number(swapData.sats_receive),
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
    if (!lightningAddress || !swapData) {
      setSendError("Payment details not available");
      return;
    }

    const success = triggerSpeedWalletPayment(
      lightningAddress,
      Number(swapData.sats_receive),
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
      {/* Swap ID Header */}
      <div className="px-6 py-4 flex items-center gap-3 border-b border-border/50 bg-muted/30">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Swap ID:
        </p>
        <code className="text-xs font-mono text-foreground flex-1">
          {swapId}
        </code>
        <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
      </div>

      {/* Content */}
      <div className="space-y-6 p-6">
        {/* Speed Wallet Mode: Simplified UI */}
        {isSpeedWallet && (
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Zap className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Pay with Speed Wallet</h3>
              <p className="text-sm text-muted-foreground">
                Tap the button below to complete your payment
              </p>
            </div>
          </div>
        )}

        {/* Standard Mode: QR Code - Hidden on mobile by default, always visible on desktop */}
        {!isSpeedWallet && arkadeAddress && (
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
                <QRCodeSVG value={unifiedAddress} size={200} level="M" />
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
                {lightningAddress ? (
                  <>
                    {/* Show shortened on mobile, full on desktop */}
                    <span className="md:hidden">
                      {shortenAddress(lightningAddress)}
                    </span>
                    <span className="hidden md:inline break-all">
                      {lightningAddress}
                    </span>
                  </>
                ) : (
                  "N/A"
                )}
              </div>
              {lightningAddress && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyAddress(lightningAddress)}
                  className="shrink-0"
                >
                  {copiedAddress === lightningAddress ? (
                    <CheckCheck className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Standard Mode: Arkade Address */}
        {!isSpeedWallet && (
          <div className="w-full space-y-2">
            <div className="text-muted-foreground text-sm font-medium">
              Arkade Address
            </div>
            <div className="flex items-center gap-2">
              <div className="dark:bg-muted/50 border-border flex-1 rounded-lg border bg-white p-3 font-mono text-xs">
                {arkadeAddress ? (
                  <>
                    {/* Show shortened on mobile, full on desktop */}
                    <span className="md:hidden">
                      {shortenAddress(arkadeAddress)}
                    </span>
                    <span className="hidden md:inline break-all">
                      {arkadeAddress}
                    </span>
                  </>
                ) : (
                  "N/A"
                )}
              </div>
              {arkadeAddress && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyAddress(arkadeAddress)}
                  className="shrink-0"
                >
                  {copiedAddress === arkadeAddress ? (
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
          {swapData && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Required Sats</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {swapData.sats_receive.toLocaleString()} sats
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    handleCopyAddress(swapData.sats_receive.toString())
                  }
                  className="h-6 w-6"
                >
                  {copiedAddress === swapData.sats_receive.toString() ? (
                    <CheckCheck className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          )}
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
                  Pay {swapData?.sats_receive.toLocaleString()} sats
                </>
              )}
            </Button>
          )}

          {/* Send from wallet - only on embedded wallets (non-Speed) - First on mobile, second on desktop */}
          {!isSpeedWallet &&
            isEmbedded &&
            isReady &&
            client &&
            arkadeAddress && (
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
