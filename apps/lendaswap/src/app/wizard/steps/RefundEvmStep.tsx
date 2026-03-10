import {
  type EvmToArkadeSwapResponse,
  type EvmToBitcoinSwapResponse,
  type EvmToLightningSwapResponse,
  toChainName,
} from "@lendasat/lendaswap-sdk-pure";
import { useAppKit } from "@reown/appkit/react";
import { ArrowRight, ChevronDown, Clock, Loader2, Zap } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { publicActions } from "viem";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible";
import { api } from "../../api";
import { SupportErrorBanner } from "../../components/SupportErrorBanner";
import { getViemChain } from "../../utils/tokenUtils";
import { DepositCard } from "../components";

interface RefundEvmStepProps {
  swapData:
    | EvmToBitcoinSwapResponse
    | EvmToArkadeSwapResponse
    | EvmToLightningSwapResponse;
}

type RefundMode = "swap-back" | "direct";

const COLLAB_REFUND_STATUSES = new Set([
  "pending",
  "clientfundedserverrefunded",
  "expired",
  "clientinvalidfunded",
  "clientfundedtoolate",
]);

function formatAmount(raw: number | string, decimals: number): string {
  return (Number(raw) / 10 ** decimals).toFixed(decimals);
}

export function RefundEvmStep({ swapData }: RefundEvmStepProps) {
  const posthog = usePostHog();
  const { address } = useAccount();
  const { open } = useAppKit();

  const swapId = swapData.id;
  const chain = getViemChain(swapData.source_token.chain);

  const { data: walletClient } = useWalletClient({ chainId: chain?.id });
  const walletPublicClient = walletClient?.extend(publicActions);
  const { switchChainAsync } = useSwitchChain();

  const [isRefunding, setIsRefunding] = useState(false);
  const [isCollabRefunding, setIsCollabRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [isLoadingCallData, setIsLoadingCallData] = useState(false);
  const [refundCallData, setRefundCallData] = useState<{
    to: string;
    data: string;
    timelockExpired: boolean;
    timelockExpiry: number;
  } | null>(null);

  const sourceSymbol = swapData.source_token.symbol;
  const sourceDecimals = swapData.source_token.decimals;
  const sourceAmount = formatAmount(swapData.source_amount, sourceDecimals);

  const targetSymbol = swapData.target_token.symbol;

  const isWbtcSource = sourceSymbol.toLowerCase() === "wbtc";

  const lockedWbtcFormatted = formatAmount(swapData.evm_expected_sats, 8);

  const collabAvailable = COLLAB_REFUND_STATUSES.has(swapData.status);

  // Countdown timer
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const refundLocktime =
    swapData.evm_refund_locktime || refundCallData?.timelockExpiry || 0;
  const isLocktimePassed = now >= refundLocktime;
  const refundLocktimeDate = new Date(refundLocktime * 1000);

  const timeRemaining = useMemo(() => {
    if (isLocktimePassed) return null;

    const secondsLeft = refundLocktime - now;
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, [now, refundLocktime, isLocktimePassed]);

  // Whether any refund action is possible right now
  const canRefund = collabAvailable || isLocktimePassed;

  const fetchRefundCallData = useCallback(
    async (mode: RefundMode) => {
      setIsLoadingCallData(true);
      setRefundError(null);
      try {
        const data = await api.refundEvmSwap(swapId, mode);
        setRefundCallData(data);
        return data;
      } catch (error) {
        console.error("Failed to fetch refund calldata:", error);
        setRefundError(
          `Failed to fetch refund data: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } finally {
        setIsLoadingCallData(false);
      }
    },
    [swapId],
  );

  // Fetch default calldata on mount
  useEffect(() => {
    if (!swapId || refundCallData) return;
    fetchRefundCallData(isWbtcSource ? "direct" : "swap-back");
  }, [swapId, isWbtcSource, refundCallData, fetchRefundCallData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collab refund for wallet-funded swaps needs a wallet connection (for signing, not gas)
  const collabNeedsWallet = collabAvailable && !swapData.gasless;

  const handleRefund = async (mode: RefundMode) => {
    // If collab is available, use it (gasless submission by server)
    if (collabAvailable) {
      return handleCollabRefund(mode === "swap-back" ? "swap-back" : "direct");
    }

    // Otherwise fall through to manual wallet-based refund
    if (!address) {
      open().catch(console.error);
      return;
    }
    if (!walletClient || !walletPublicClient) {
      open().catch(console.error);
      return;
    }
    if (!switchChainAsync || !chain) {
      setRefundError(
        "Chain switching not available. Please refresh and try again.",
      );
      return;
    }
    if (!isLocktimePassed) {
      setRefundError("The refund locktime has not been reached yet");
      return;
    }

    setIsRefunding(true);
    setRefundError(null);
    setRefundSuccess(null);

    try {
      await switchChainAsync({ chainId: chain.id });

      const callData = await fetchRefundCallData(mode);
      if (!callData) return;

      const refundTxHash = await walletClient.sendTransaction({
        to: callData.to as `0x${string}`,
        data: callData.data as `0x${string}`,
        chain,
        gas: 500_000n,
      });

      const refundReceipt = await walletPublicClient.waitForTransactionReceipt({
        hash: refundTxHash,
      });

      if (refundReceipt.status !== "success") {
        throw new Error("Refund transaction reverted");
      }

      setRefundSuccess(`Refund successful! Transaction: ${refundTxHash}`);

      posthog?.capture("swap_refunded", {
        swap_id: swapId,
        refund_mode: mode,
        refund_txid: refundTxHash,
      });
    } catch (err) {
      console.error("Refund error:", err);
      setRefundError(
        err instanceof Error ? err.message : "Failed to execute refund",
      );
    } finally {
      setIsRefunding(false);
    }
  };

  const handleCollabRefund = async (
    settlement: "swap-back" | "direct" = "direct",
  ) => {
    setIsCollabRefunding(true);
    setRefundError(null);
    setRefundSuccess(null);

    try {
      let result: { txHash: string };

      if (swapData.gasless) {
        // Gasless (Permit2) swap — SDK-derived key is the depositor, sign internally
        result = await api.collabRefundEvmSwap(swapId, settlement);
      } else {
        // Wallet-funded swap — user's wallet is the depositor, sign via wallet
        if (!walletClient || !address) {
          open().catch(console.error);
          return;
        }

        const { typedData, params } = await api.buildCollabRefundEvmTypedData(
          swapId,
          settlement,
        );

        const signature = await walletClient.signTypedData({
          domain: {
            ...typedData.domain,
            verifyingContract: typedData.domain
              .verifyingContract as `0x${string}`,
          },
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: {
            preimageHash: typedData.message.preimageHash as `0x${string}`,
            amount: typedData.message.amount,
            token: typedData.message.token as `0x${string}`,
            claimAddress: typedData.message.claimAddress as `0x${string}`,
            timelock: typedData.message.timelock,
            caller: typedData.message.caller as `0x${string}`,
            sweepToken: typedData.message.sweepToken as `0x${string}`,
            minAmountOut: typedData.message.minAmountOut,
            callsHash: typedData.message.callsHash as `0x${string}`,
          },
          account: walletClient.account,
        });

        // Parse v, r, s from the 65-byte signature
        const sigHex = signature.replace(/^0x/, "");
        const r = `0x${sigHex.slice(0, 64)}`;
        const s = `0x${sigHex.slice(64, 128)}`;
        const v = Number.parseInt(sigHex.slice(128, 130), 16);

        result = await api.submitCollabRefundEvm(swapId, {
          v,
          r,
          s,
          depositor_address: address,
          mode: settlement,
          sweep_token: params.sweepToken,
          min_amount_out: params.minAmountOut,
        });
      }

      const label = settlement === "swap-back" ? sourceSymbol : "WBTC";
      setRefundSuccess(
        `Refund as ${label} successful! Transaction: ${result.txHash}`,
      );

      posthog?.capture("swap_refunded", {
        swap_id: swapId,
        refund_mode: `collab-${settlement}`,
        refund_txid: result.txHash,
      });
    } catch (err) {
      console.error("Collaborative refund error:", err);
      setRefundError(
        err instanceof Error
          ? err.message
          : "Failed to execute collaborative refund",
      );
    } finally {
      setIsCollabRefunding(false);
    }
  };

  const anyRefundInProgress = isRefunding || isCollabRefunding;

  return (
    <DepositCard
      sourceToken={swapData.source_token}
      targetToken={swapData.target_token}
      swapId={swapId}
      title={`Refund ${swapData.source_token.symbol} → ${swapData.target_token.symbol}`}
    >
      <div className="space-y-6">
        {/* Status line */}
        {!refundSuccess && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {collabAvailable ? (
              <>
                <Zap className="h-4 w-4 text-blue-500" />
                <span>
                  Instant refund available · gasless
                  {!swapData.gasless && ", wallet signature required"}
                </span>
              </>
            ) : isLocktimePassed ? (
              <>
                <Clock className="h-4 w-4 text-green-500" />
                <span>Refund available via wallet transaction</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-orange-500" />
                <span>Refund available in {timeRemaining}</span>
              </>
            )}
          </div>
        )}

        {/* Primary refund buttons */}
        {!refundSuccess && canRefund && (
          <div className="flex flex-col gap-2">
            {!isWbtcSource && (
              <>
                <Button
                  onClick={() => handleRefund("swap-back")}
                  disabled={
                    anyRefundInProgress ||
                    ((collabNeedsWallet || !collabAvailable) && !address) ||
                    isLoadingCallData
                  }
                  className="w-full h-12 text-base font-semibold"
                >
                  {anyRefundInProgress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Refund as ${sourceSymbol}`
                  )}
                </Button>
                <Button
                  onClick={() => handleRefund("direct")}
                  disabled={
                    anyRefundInProgress ||
                    ((collabNeedsWallet || !collabAvailable) && !address) ||
                    isLoadingCallData
                  }
                  variant="outline"
                  className="w-full h-12 text-base font-semibold"
                >
                  {anyRefundInProgress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Refund as WBTC"
                  )}
                </Button>
              </>
            )}

            {isWbtcSource && (
              <Button
                onClick={() => handleRefund("direct")}
                disabled={
                  anyRefundInProgress ||
                  ((collabNeedsWallet || !collabAvailable) && !address) ||
                  isLoadingCallData
                }
                className="w-full h-12 text-base font-semibold"
              >
                {anyRefundInProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Refund as WBTC"
                )}
              </Button>
            )}

            {!isWbtcSource && (
              <p className="text-xs text-muted-foreground">
                Refunding as {sourceSymbol} swaps WBTC back via a DEX — amount
                may vary slightly due to exchange rate.
              </p>
            )}
          </div>
        )}

        {/* No refund path available — collab unavailable and timelock not passed */}
        {!refundSuccess && !canRefund && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-500/30 rounded-lg p-4 space-y-2">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Instant refund is not available for this swap. Manual refund will
              unlock in:
            </p>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100 font-mono">
              {timeRemaining}
            </div>
          </div>
        )}

        {/* Swap details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium">{sourceSymbol}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{targetSymbol}</span>
            <span className="text-muted-foreground ml-1">
              ({sourceAmount} {sourceSymbol} on{" "}
              {toChainName(swapData.source_token.chain)})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Locked in HTLC</p>
              <p className="font-mono">{lockedWbtcFormatted} WBTC</p>
            </div>
            <div>
              <p className="text-muted-foreground">Refund Locktime</p>
              <p className="font-mono">
                {refundLocktimeDate.toLocaleString()}
                <span
                  className={`ml-1 ${isLocktimePassed ? "text-green-600" : "text-orange-600"}`}
                >
                  ({isLocktimePassed ? "Passed" : "Locked"})
                </span>
              </p>
            </div>
          </div>

          <div className="text-xs">
            <p className="text-muted-foreground">HTLC Address</p>
            <p className="font-mono break-all text-muted-foreground">
              {swapData.evm_htlc_address}
            </p>
          </div>
        </div>

        {/* Manual refund disclosure — only shown when collab is available and timelock has also passed */}
        {collabAvailable && isLocktimePassed && !refundSuccess && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className="h-3 w-3" />
              Advanced: refund manually via wallet
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {!address && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Connect your wallet to use manual refund
                  </AlertDescription>
                </Alert>
              )}

              {!isWbtcSource && (
                <Button
                  onClick={() => handleManualRefund("swap-back")}
                  disabled={
                    anyRefundInProgress || !address || isLoadingCallData
                  }
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Manual Refund as {sourceSymbol}
                </Button>
              )}
              <Button
                onClick={() => {
                  handleManualRefund("direct");
                }}
                disabled={anyRefundInProgress || !address || isLoadingCallData}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Manual Refund as WBTC
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Error Display */}
        {refundError && (
          <SupportErrorBanner
            message="Refund failed"
            error={refundError}
            swapId={swapId}
          />
        )}

        {/* Success Display */}
        {refundSuccess && (
          <Alert>
            <AlertDescription>{refundSuccess}</AlertDescription>
          </Alert>
        )}

        {isLoadingCallData && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <p className="text-xs text-muted-foreground">
              Loading refund data...
            </p>
          </div>
        )}
      </div>
    </DepositCard>
  );

  // Manual wallet-based refund (bypasses collab, always uses wallet)
  async function handleManualRefund(mode: RefundMode) {
    if (!address) {
      open().catch(console.error);
      return;
    }
    if (!walletClient || !walletPublicClient) {
      open().catch(console.error);
      return;
    }
    if (!switchChainAsync || !chain) {
      setRefundError(
        "Chain switching not available. Please refresh and try again.",
      );
      return;
    }

    setIsRefunding(true);
    setRefundError(null);
    setRefundSuccess(null);

    try {
      await switchChainAsync({ chainId: chain.id });

      const callData = await fetchRefundCallData(mode);
      if (!callData) return;

      const refundTxHash = await walletClient.sendTransaction({
        to: callData.to as `0x${string}`,
        data: callData.data as `0x${string}`,
        chain,
        gas: 500_000n,
      });

      const refundReceipt = await walletPublicClient.waitForTransactionReceipt({
        hash: refundTxHash,
      });

      if (refundReceipt.status !== "success") {
        throw new Error("Refund transaction reverted");
      }

      setRefundSuccess(`Refund successful! Transaction: ${refundTxHash}`);

      posthog?.capture("swap_refunded", {
        swap_id: swapId,
        refund_mode: `manual-${mode}`,
        refund_txid: refundTxHash,
      });
    } catch (err) {
      console.error("Manual refund error:", err);
      setRefundError(
        err instanceof Error ? err.message : "Failed to execute refund",
      );
    } finally {
      setIsRefunding(false);
    }
  }
}
