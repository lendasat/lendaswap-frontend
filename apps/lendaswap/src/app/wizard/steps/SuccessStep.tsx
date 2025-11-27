import { Check, CheckCheck, Copy, ExternalLink, Heart, Twitter } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import type { GetSwapResponse } from "../../api";
import { getTokenSymbol } from "../../api";
import {
  getBlockexplorerAddressLink,
  getBlockexplorerTxLink,
} from "../../utils/tokenUtils";
import { isValidSpeedWalletContext } from "../../../utils/speedWallet";

interface SuccessStepProps {
  swapData: GetSwapResponse;
  swapDirection: "btc-to-polygon" | "polygon-to-btc";
  swapId: string;
}

export function SuccessStep({
  swapData,
  swapDirection,
  swapId,
}: SuccessStepProps) {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Track swap completion event
  useEffect(() => {
    const swapDurationSeconds = swapData.created_at
      ? Math.floor(
          (Date.now() - new Date(swapData.created_at).getTime()) / 1000,
        )
      : null;

    posthog?.capture("swap_completed", {
      swap_id: swapId,
      swap_direction: swapDirection,
      source_token: swapData.source_token,
      target_token: swapData.target_token,
      amount_usd: swapData.usd_amount,
      amount_sats: swapData.sats_receive,
      fee_sats: swapData.fee_sats,
      duration_seconds: swapDurationSeconds,
    });
  }, [swapId, swapDirection, swapData, posthog]);

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
    ? Math.floor((Date.now() - new Date(swapData.created_at).getTime()) / 1000)
    : null;

  // Define config based on swap direction
  const config =
    swapDirection === "btc-to-polygon"
      ? {
          sentTokenSymbol: "sats",
          sentAmount: swapData.sats_receive.toLocaleString(),
          receivedTokenSymbol: getTokenSymbol(swapData.target_token),
          receivedAmount: swapData.usd_amount.toFixed(2),
          receiveAddress: swapData.user_address_evm,
          receiveAddressIsPolygon: true,
          swapTxId: swapData.evm_htlc_claim_txid,
          swapTxIdIsPolygon: true,
          tweetText: `Swapped ${swapData.sats_receive.toLocaleString()} sats → $${swapData.usd_amount.toFixed(2)} ${getTokenSymbol(swapData.target_token)} in ${swapDurationSeconds}s on @lendasat\n\nTrustless atomic swap via @arkade_os`,
        }
      : {
          sentTokenSymbol: getTokenSymbol(swapData.source_token),
          sentAmount: swapData.usd_amount.toFixed(2),
          receivedTokenSymbol: "sats",
          receivedAmount: swapData.sats_receive.toLocaleString(),
          receiveAddress: swapData.user_address_arkade,
          receiveAddressIsPolygon: false,
          swapTxId: swapData.bitcoin_htlc_claim_txid,
          swapTxIdIsPolygon: false,
          tweetText: `Swapped $${swapData.usd_amount.toFixed(2)} ${getTokenSymbol(swapData.source_token)} → ${swapData.sats_receive.toLocaleString()} sats in ${swapDurationSeconds}s on @lendasat\n\nTrustless atomic swap via @arkade_os`,
        };

  const handleShareOnTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(config.tweetText)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
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
      <div className="p-6">
        <div className="flex flex-col items-center space-y-6">
          {/* Success Icon */}
          <div className="bg-foreground flex h-16 w-16 items-center justify-center rounded-full">
            <Check className="text-background h-8 w-8" />
          </div>

          {/* Success Message */}
          <div className="space-y-2 text-center">
            {isValidSpeedWalletContext() ? (
              <h3 className="text-2xl font-semibold flex items-center justify-center gap-2">
                Speed <Heart className="h-6 w-6 text-red-500 fill-red-500" /> LendaSwap
              </h3>
            ) : (
              <h3 className="text-2xl font-semibold">Swap Complete!</h3>
            )}
            <p className="text-muted-foreground text-sm">
              Your {config.receivedTokenSymbol} has been successfully sent to
              your address
            </p>
          </div>

          {/* LIFETIME OFFER Banner */}
          <div className="w-full max-w-md">
            <div className="relative overflow-hidden rounded-xl border-2 border-green-500/50 bg-gradient-to-r from-green-500/20 via-green-400/20 to-green-500/20 p-6 shadow-lg">
              {/* Animated background effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent animate-shimmer" />

              <div className="relative space-y-4 text-center">
                <p className="text-sm text-green-600 dark:text-green-400">
                  Share your swap on 𝕏
                </p>
                <Button
                  onClick={handleShareOnTwitter}
                  className="w-full gap-2 bg-black hover:bg-black/90 text-white dark:bg-white dark:hover:bg-white/90 dark:text-black"
                >
                  <Twitter className="h-4 w-4" />
                  Share on 𝕏
                </Button>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="bg-muted/50 w-full max-w-md space-y-3 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Sent</span>
              <span className="font-medium">
                {config.sentAmount} {config.sentTokenSymbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Received</span>
              <span className="font-medium">
                {config.receivedAmount} {config.receivedTokenSymbol}
              </span>
            </div>
            <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
              <span className="text-muted-foreground">Sent to Address</span>
              <div className="flex items-center gap-2">
                {config.receiveAddressIsPolygon ? (
                  <a
                    href={`${getBlockexplorerAddressLink(swapData.target_token, config?.receiveAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 break-all font-mono text-xs hover:underline"
                  >
                    {config.receiveAddress}
                  </a>
                ) : (
                  <span className="flex-1 break-all font-mono text-xs">
                    {config.receiveAddress}
                  </span>
                )}
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      handleCopyAddress(config.receiveAddress || "")
                    }
                    className="h-8 w-8"
                  >
                    {copiedAddress === config.receiveAddress ? (
                      <CheckCheck className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  {config.receiveAddressIsPolygon && (
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                      className="h-8 w-8"
                    >
                      <a
                        href={`${getBlockexplorerAddressLink(swapData.target_token, config?.receiveAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
              <span className="text-muted-foreground">Transaction Hash</span>
              {config.swapTxId ? (
                <div className="flex items-center gap-2">
                  {config.swapTxIdIsPolygon ? (
                    <a
                      href={`${getBlockexplorerTxLink(swapData.target_token, config.swapTxId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 break-all font-mono text-xs hover:underline"
                    >
                      {config.swapTxId}
                    </a>
                  ) : (
                    <span className="flex-1 break-all font-mono text-xs">
                      {config.swapTxId}
                    </span>
                  )}
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopyAddress(config.swapTxId || "")}
                      className="h-8 w-8"
                    >
                      {copiedAddress === config.swapTxId ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    {config.swapTxIdIsPolygon && (
                      <Button
                        size="icon"
                        variant="ghost"
                        asChild
                        className="h-8 w-8"
                      >
                        <a
                          href={`${getBlockexplorerTxLink(swapData.target_token, config.swapTxId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
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
    </div>
  );
}
