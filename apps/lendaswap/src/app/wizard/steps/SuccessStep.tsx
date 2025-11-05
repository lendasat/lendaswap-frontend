import { Check, CheckCheck, Copy, ExternalLink, Twitter } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import { useState } from "react";
import type { GetSwapResponse } from "../../api";
import { getTokenSymbol } from "../../api";
import { SuccessMeme } from "../../components/SuccessMeme";

interface SuccessStepProps {
  swapData: GetSwapResponse;
}

export function SuccessStep({ swapData }: SuccessStepProps) {
  const navigate = useNavigate();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const handleStartNewSwap = () => {
    navigate("/", { replace: true });
  };

  // Calculate swap duration if we have timestamps
  const swapDurationSeconds = swapData.created_at
    ? Math.floor(
        (new Date().getTime() - new Date(swapData.created_at).getTime()) / 1000,
      )
    : null;

  const tokenSymbol = getTokenSymbol(swapData.target_token);
  const usdcAmount = swapData.usd_amount.toFixed(2);
  const receiveAddress = swapData.user_address_polygon;
  const swapTxId = swapData.polygon_htlc_claim_txid;

  const handleShareOnTwitter = () => {
    const tweetText = `Just swapped ${swapData.sats_required.toLocaleString()} sats to ${usdcAmount} ${tokenSymbol} in ${swapDurationSeconds}s on @lendasat! ⚡️\n\nFast, secure, and atomic swaps with 0% fees! 🚀\n\nTry it: https://swap.lendasat.com`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="py-12">
      <div className="flex flex-col items-center space-y-6">
        {/* Success Icon */}
        <div className="bg-foreground flex h-16 w-16 items-center justify-center rounded-full">
          <Check className="text-background h-8 w-8" />
        </div>

        {/* Success Message */}
        <div className="space-y-2 text-center">
          <h3 className="text-2xl font-semibold">Swap Complete!</h3>
          <p className="text-muted-foreground text-sm">
            Your {tokenSymbol} has been successfully sent to your address
          </p>
        </div>

        {/* LIFETIME OFFER Banner */}
        <div className="w-full max-w-md">
          <div className="relative overflow-hidden rounded-xl border-2 border-green-500/50 bg-gradient-to-r from-green-500/20 via-green-400/20 to-green-500/20 p-6 shadow-lg">
            {/* Animated background effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent animate-shimmer" />

            <div className="relative space-y-4 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-600 dark:text-green-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                LIFETIME OFFER
              </div>
              <h4 className="text-xl font-bold text-green-700 dark:text-green-300">
                Swap with 0% Fees Forever!
              </h4>
              <p className="text-sm text-green-600 dark:text-green-400">
                Share your swap on 𝕏 to unlock permanent fee-free swaps
              </p>
              <p className="text-xs text-green-600/80 dark:text-green-400/80">
                (we'll send you a DM with your individual browser code)
              </p>
              <Button
                onClick={handleShareOnTwitter}
                className="w-full gap-2 bg-black hover:bg-black/90 text-white dark:bg-white dark:hover:bg-white/90 dark:text-black"
              >
                <Twitter className="h-4 w-4" />
                Share on 𝕏 & Unlock Lifetime 0% Fees
              </Button>
            </div>
          </div>
        </div>

        {/* Success Meme with Share Button */}
        <SuccessMeme />

        {/* Transaction Details */}
        <div className="bg-muted/50 w-full max-w-md space-y-3 rounded-lg p-4">
          <h4 className="mb-3 text-sm font-medium">Transaction Details</h4>
          {swapData.id && (
            <div className="border-border flex flex-col gap-2 border-b pb-2 text-sm">
              <span className="text-muted-foreground">Swap ID</span>
              <div className="flex items-center gap-2">
                <span className="flex-1 break-all font-mono text-xs">
                  {swapData.id}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyAddress(swapData.id)}
                  className="h-8 w-8 shrink-0"
                >
                  {copiedAddress === swapData.id ? (
                    <CheckCheck className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount Sent</span>
            <span className="font-medium">
              {swapData.sats_required.toLocaleString()} sats
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount Received</span>
            <span className="font-medium">
              {usdcAmount} {tokenSymbol}
            </span>
          </div>
          <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
            <span className="text-muted-foreground">Sent to Address</span>
            <div className="flex items-center gap-2">
              <a
                href={`https://polygonscan.com/address/${receiveAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 break-all font-mono text-xs hover:underline"
              >
                {receiveAddress}
              </a>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyAddress(receiveAddress)}
                  className="h-8 w-8"
                >
                  {copiedAddress === receiveAddress ? (
                    <CheckCheck className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button size="icon" variant="ghost" asChild className="h-8 w-8">
                  <a
                    href={`https://polygonscan.com/address/${receiveAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
          <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
            <span className="text-muted-foreground">Transaction Hash</span>
            {swapTxId ? (
              <div className="flex items-center gap-2">
                <a
                  href={`https://polygonscan.com/tx/${swapTxId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 break-all font-mono text-xs hover:underline"
                >
                  {swapTxId}
                </a>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopyAddress(swapTxId)}
                    className="h-8 w-8"
                  >
                    {copiedAddress === swapTxId ? (
                      <CheckCheck className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    asChild
                    className="h-8 w-8"
                  >
                    <a
                      href={`https://polygonscan.com/tx/${swapTxId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground font-mono text-xs">
                N/A
              </span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <Button
          className="h-12 w-full max-w-md text-base font-semibold"
          onClick={handleStartNewSwap}
        >
          Start New Swap
        </Button>
      </div>
    </div>
  );
}
