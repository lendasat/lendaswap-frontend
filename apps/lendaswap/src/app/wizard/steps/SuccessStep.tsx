import { toChainName } from "@lendasat/lendaswap-sdk-pure";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  Heart,
} from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import isValidSpeedWalletContext from "../../../utils/speedWallet";
import { api, type GetSwapResponse } from "../../api";
import {
  getBlockexplorerAddressLink,
  getBlockexplorerTxLink,
  getTokenIcon,
  getTokenNetworkIcon,
} from "../../utils/tokenUtils";

interface SuccessStepProps {
  swapData: GetSwapResponse;
}

interface DirectionConfig {
  sourceAmount: string;
  targetAmount: string;
  targetAddress?: string | null;
  isLightning: boolean;
  noAddressLink?: boolean;
  swapTxId?: string | null;
  tweetText: string;
}

export function SuccessStep({ swapData }: SuccessStepProps) {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  console.log(`SwapData ${JSON.stringify(swapData.target_token)}`);

  // Calculate swap duration if we have timestamps
  const swapDurationSeconds = swapData.created_at
    ? Math.floor((Date.now() - new Date(swapData.created_at).getTime()) / 1000)
    : null;

  const swapId = swapData.id;
  const isArkadeTarget =
    swapData.direction === "evm_to_arkade" ||
    swapData.direction === "btc_to_arkade" ||
    swapData.direction === "lightning_to_arkade";

  const [hasVtxo, setHasVtxo] = useState(false);
  useEffect(() => {
    if (!isArkadeTarget) return;
    let cancelled = false;

    api
      .hasReceivedVtxo(swapId)
      .then((result) => {
        if (!cancelled) setHasVtxo(result);
      })
      .catch((err) => {
        console.error("hasReceivedVtxo error:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [swapId, isArkadeTarget]);

  // Track swap completion event
  useEffect(() => {
    posthog?.capture("swap_completed", {
      swap_id: swapId,
      swap_direction: swapData.direction,
      source_token: swapData.source_token,
      target_token: swapData.target_token,
      fee_sats: swapData.fee_sats,
      duration_seconds: swapDurationSeconds,
    });
  }, [swapId, swapData, posthog, swapDurationSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const sourceSymbol = swapData.source_token.symbol;
  const targetSymbol = swapData.target_token.symbol;
  const sourceNetwork = toChainName(swapData.source_token.chain);
  const targetNetwork = toChainName(swapData.target_token.chain);

  function makeTweet(sent: string, received: string): string {
    return `Swapped ${sent} ${sourceSymbol} → ${received} ${targetSymbol} in ${swapDurationSeconds}s on @lendasat\n\nTrustless atomic swap via @arkade_os`;
  }

  const formatAmount = (amount: number | string, decimals: number): string => {
    const value = Number(amount) / 10 ** decimals;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  // Build config based on the discriminated direction field
  const getConfig = (): DirectionConfig => {
    const sent = formatAmount(
      swapData.source_amount,
      swapData.source_token.decimals,
    );
    const received = formatAmount(
      swapData.target_amount,
      swapData.target_token.decimals,
    );

    switch (swapData.direction) {
      case "btc_to_arkade": {
        return {
          sourceAmount: sent,
          targetAmount: received,
          targetAddress: swapData.target_arkade_address,
          isLightning: false,
          swapTxId: swapData.arkade_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "bitcoin_to_evm": {
        return {
          sourceAmount: sent,
          targetAmount: received,
          targetAddress:
            swapData.target_evm_address ?? swapData.client_evm_address,
          isLightning: false,
          swapTxId: swapData.evm_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "arkade_to_evm": {
        const received = formatAmount(
          swapData.target_amount ?? 0,
          swapData.target_token.decimals,
        );
        return {
          sourceAmount: sent,
          targetAmount: received,
          targetAddress:
            swapData.target_evm_address ?? swapData.client_evm_address,
          isLightning: false,
          swapTxId: swapData.evm_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "evm_to_arkade": {
        return {
          sourceAmount: sent,
          targetAmount: received,
          targetAddress: swapData.target_arkade_address,
          isLightning: false,
          swapTxId: swapData.btc_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "evm_to_bitcoin": {
        return {
          sourceAmount: sent,
          targetAmount: received,
          targetAddress: swapData.btc_htlc_address,
          isLightning: false,
          swapTxId: swapData.btc_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "lightning_to_evm": {
        const sent = formatAmount(
          swapData.source_amount,
          swapData.source_token.decimals,
        );
        const received = formatAmount(
          swapData.target_amount,
          swapData.target_token.decimals,
        );
        return {
          sourceAmount: sent,
          targetAmount: received,
          targetAddress:
            swapData.target_evm_address ?? swapData.client_evm_address,
          isLightning: false,
          swapTxId: swapData.evm_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "evm_to_lightning": {
        return {
          sourceAmount: sent,
          targetAmount: received,
          targetAddress: swapData.client_lightning_invoice,
          isLightning: true,
          swapTxId: swapData.evm_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "lightning_to_arkade": {
        return {
          sourceAmount: sent,
          targetAmount: received,
          targetAddress: swapData.target_arkade_address,
          isLightning: false,
          swapTxId: swapData.arkade_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "arkade_to_lightning": {
        return {
          sourceAmount: sent,
          targetAmount: received,
          targetAddress: swapData.client_lightning_invoice,
          isLightning: true,
          noAddressLink: true,
          swapTxId: swapData.arkade_fund_txid,
          tweetText: makeTweet(sent, received),
        };
      }
    }
  };

  const config = getConfig();

  const targetAmount = config.targetAmount;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Source token */}
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
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          {/* Target token */}
          <div className="relative">
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-muted border border-border">
              <div className="w-5 h-5 flex items-center justify-center">
                {getTokenIcon(swapData.target_token)}
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background p-[1px] flex items-center justify-center">
              <div className="w-full h-full rounded-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full">
                {getTokenNetworkIcon(swapData.target_token)}
              </div>
            </div>
          </div>
          <h3 className="text-sm font-semibold">
            {sourceSymbol} → {targetSymbol}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopyAddress(swapId)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Copy Swap ID"
          >
            <code className="text-[10px] font-mono">{swapId.slice(0, 8)}…</code>
            {copiedAddress === swapId ? (
              <CheckCheck className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
          <div className="h-2 w-2 rounded-full bg-green-500" />
        </div>
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
                Speed <Heart className="h-6 w-6 text-red-500 fill-red-500" />{" "}
                LendaSwap
              </h3>
            ) : (
              <h3 className="text-2xl font-semibold">Swap Complete!</h3>
            )}
            <p className="text-muted-foreground text-sm">
              Your {targetSymbol} has been successfully sent to your address
            </p>
          </div>

          {/* Transaction Details */}
          <div className="bg-muted/50 w-full max-w-md space-y-3 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Sent</span>
              <span className="font-medium">
                {config.sourceAmount} {sourceSymbol}
                {" on "}
                {sourceNetwork}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Received</span>
              <span className="font-medium">
                {targetAmount} {targetSymbol} {" on "}
                {targetNetwork}
              </span>
            </div>
            {config.targetAddress && (
              <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
                <span className="text-muted-foreground">
                  {config.isLightning
                    ? "Sent to Invoice/Address"
                    : "Sent to Address"}
                </span>
                <div className="flex items-center gap-2">
                  {config.noAddressLink ? (
                    <span className="flex-1 break-all font-mono text-xs">
                      {config.targetAddress}
                    </span>
                  ) : (
                    <a
                      href={`${getBlockexplorerAddressLink(swapData.target_token.chain, config.targetAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 break-all font-mono text-xs hover:underline"
                    >
                      {config.targetAddress}
                    </a>
                  )}
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        handleCopyAddress(config.targetAddress ?? "")
                      }
                      className="h-8 w-8"
                    >
                      {copiedAddress === config.targetAddress ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    {!config.noAddressLink && (
                      <Button
                        size="icon"
                        variant="ghost"
                        asChild
                        className="h-8 w-8"
                      >
                        <a
                          href={`${getBlockexplorerAddressLink(swapData.target_token.chain, config.targetAddress)}`}
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
            )}
            {config.swapTxId && (
              <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
                <span className="text-muted-foreground">Transaction Hash</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`${getBlockexplorerTxLink(swapData.target_token.chain, config.swapTxId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 break-all font-mono text-xs hover:underline"
                  >
                    {config.swapTxId}
                  </a>
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
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                      className="h-8 w-8"
                    >
                      <a
                        href={`${getBlockexplorerTxLink(swapData.target_token.chain, config.swapTxId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recovery warning for Arkade swaps */}
          {isArkadeTarget && !hasVtxo && (
            <div className="w-full max-w-md space-y-3">
              <div className="rounded-lg border border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Funds not yet received on Arkade
                </div>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                  Your swap completed but the funds haven't arrived in your
                  Arkade wallet yet. This can happen if the claim wasn't fully
                  finalized. Click below to recover your funds.
                </p>
              </div>
              <Button
                variant="outline"
                className="h-12 w-full border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/20"
                onClick={async () => {
                  try {
                    const result = await api.continueArkadeClaimSwap(swapId);
                    if (result.success) {
                      setHasVtxo(true);
                    }
                    console.log(`continueArkadeClaim(${swapId}):`, result);
                  } catch (err) {
                    console.error("continueArkadeClaim error:", err);
                  }
                }}
              >
                Recover Funds
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full max-w-md">
            <Button
              className="h-12 w-full text-base font-semibold"
              onClick={handleStartNewSwap}
            >
              Start New Swap
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
