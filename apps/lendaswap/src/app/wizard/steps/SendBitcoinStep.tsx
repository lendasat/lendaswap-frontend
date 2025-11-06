import { CheckCheck, Copy, Loader2, Wallet, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "#/components/ui/button";
import { CardContent } from "#/components/ui/card";
import { BtcToPolygonSwapResponse } from "../../api";
import { useWalletBridge } from "../../WalletBridgeContext";

interface SendBitcoinStepProps {
  arkadeAddress: string | null;
  lightningAddress: string | null;
  unifiedAddress: string;
  swapData: BtcToPolygonSwapResponse | null;
  usdcAmount: string;
  tokenSymbol?: string; // e.g., "USDC", "USDT"
}

export function SendBitcoinStep({
  arkadeAddress,
  lightningAddress,
  unifiedAddress,
  swapData,
  usdcAmount,
  tokenSymbol = "USDC",
}: SendBitcoinStepProps) {
  const navigate = useNavigate();
  const { swapId } = useParams<{ swapId: string }>();
  const { client, isEmbedded, isReady } = useWalletBridge();
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);

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
        swapData.sats_required,
        "bitcoin",
      );

      // Trust the client - navigate immediately to processing page
      navigate(`/swap/${swapId}/processing`);
    } catch (error) {
      console.error("Failed to send from wallet:", error);
      setSendError(
        error instanceof Error ? error.message : "Failed to send from wallet",
      );
      setIsSending(false);
    }
  };

  return (
    <CardContent className="space-y-6 pt-2">
      {/* QR Code - Hidden on mobile by default, always visible on desktop */}
      {arkadeAddress && (
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

      {/* Lightning Address */}
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

      {/* Arkade Address */}
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

      {/* Amount Reminder */}
      <div className="bg-muted/50 space-y-2 rounded-lg p-4">
        {swapData && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Required Sats</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {swapData.sats_required.toLocaleString()} sats
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  handleCopyAddress(swapData.sats_required.toString())
                }
                className="h-6 w-6"
              >
                {copiedAddress === swapData.sats_required.toString() ? (
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
            {usdcAmount} {tokenSymbol}
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
        {/* Waiting for payment - always first */}
        <Button className="h-12 w-full text-base font-semibold" disabled={true}>
          Waiting for payment
        </Button>

        {/* Send from wallet - only on embedded wallets */}
        {isEmbedded && isReady && client && arkadeAddress && (
          <Button
            variant="outline"
            className="h-12 w-full text-base font-semibold"
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

        {/* Back button */}
        <Button
          variant="outline"
          className="h-12 w-full"
          onClick={() => navigate("/")}
        >
          Back
        </Button>
      </div>
    </CardContent>
  );
}
