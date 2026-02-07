import { ArrowRight, Clock, Loader2, Unlock } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { api, type EvmToArkadeSwapResponse } from "../../api";
import { getViemChainById } from "../../utils/tokenUtils";

interface RefundEvmStepProps {
  swapData: EvmToArkadeSwapResponse;
  swapId: string;
}

export function RefundEvmStep({ swapData, swapId }: RefundEvmStepProps) {
  const posthog = usePostHog();
  const { address } = useAccount();

  const chain = getViemChainById(swapData.evm_chain_id);

  const { data: walletClient } = useWalletClient({ chainId: chain?.id });
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { switchChainAsync } = useSwitchChain();

  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [refundCallData, setRefundCallData] = useState<{
    to: string;
    data: string;
    timelockExpired: boolean;
    timelockExpiry: number;
  } | null>(null);
  const [isLoadingCallData, setIsLoadingCallData] = useState(false);

  const tokenSymbol = swapData.source_token.symbol;

  // Countdown timer state
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Use evm_refund_locktime from the swap data, or fallback to calldata timelockExpiry
  const refundLocktime =
    swapData.evm_refund_locktime ||
    refundCallData?.timelockExpiry ||
    0;
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

  // Fetch refund calldata from SDK
  useEffect(() => {
    if (!swapId || refundCallData) return;

    const fetchCallData = async () => {
      setIsLoadingCallData(true);
      try {
        const data = await api.refundEvmSwap(swapId);
        setRefundCallData(data);
      } catch (error) {
        console.error("Failed to fetch refund calldata:", error);
        setRefundError(
          `Failed to fetch refund data: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsLoadingCallData(false);
      }
    };

    fetchCallData();
  }, [swapId, refundCallData]);

  const handleRefund = async () => {
    if (!walletClient || !address || !publicClient) {
      setRefundError("Please connect your wallet");
      return;
    }

    if (!switchChainAsync) {
      setRefundError(
        "Chain switching not available. Please refresh and try again.",
      );
      return;
    }

    if (!isLocktimePassed) {
      setRefundError("The refund locktime has not been reached yet");
      return;
    }

    if (!refundCallData) {
      setRefundError("Refund data not yet loaded");
      return;
    }

    setIsRefunding(true);
    setRefundError(null);
    setRefundSuccess(null);

    try {
      if (!chain) {
        throw new Error(
          `Unsupported chain ID: ${swapData.evm_chain_id}`,
        );
      }

      // Switch to the correct chain if needed
      console.log("Switching to chain:", chain.name);
      await switchChainAsync({ chainId: chain.id });

      console.log("Executing refund transaction...");
      const refundTxHash = await walletClient.sendTransaction({
        to: refundCallData.to as `0x${string}`,
        data: refundCallData.data as `0x${string}`,
        chain,
      });

      console.log("Refund transaction hash:", refundTxHash);
      console.log("Waiting for refund transaction to be mined...");

      const refundReceipt = await publicClient.waitForTransactionReceipt({
        hash: refundTxHash,
      });

      console.log("Refund transaction confirmed:", refundReceipt.status);

      if (refundReceipt.status !== "success") {
        throw new Error(`Refund transaction failed: ${refundReceipt.status}`);
      }

      setRefundSuccess(`Refund successful! Transaction hash: ${refundTxHash}`);

      posthog?.capture("swap_refunded", {
        swap_id: swapId,
        swap_direction: "evm-to-arkade",
        refund_reason: "user_initiated",
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

  const sourceSymbol = swapData.source_token.symbol;
  const targetSymbol = swapData.target_token.symbol;

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
        <div className="h-2 w-2 rounded-full bg-orange-500/50 animate-pulse" />
      </div>

      {/* Content */}
      <div className="space-y-6 p-6">
        {/* Refund Status Banner */}
        {isLocktimePassed ? (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-500 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Unlock className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                Refund Available
              </h3>
            </div>
            <p className="text-sm text-green-800 dark:text-green-200">
              The refund locktime has passed. You can now refund your{" "}
              {tokenSymbol} from this swap.
            </p>
          </div>
        ) : (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-500 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                Refund Locked
              </h3>
            </div>
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Your funds are temporarily locked. Refund will be available in:
            </p>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100 font-mono">
              {timeRemaining}
            </div>
          </div>
        )}

        {/* Refund Details */}
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Swap</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{sourceSymbol}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">{targetSymbol}</span>
              <span className="text-xs text-muted-foreground ml-2">
                ({swapData.source_token_amount} {sourceSymbol})
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Coordinator Address</p>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {swapData.evm_htlc_address}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Refund Amount</p>
            <p className="text-xs text-muted-foreground">
              {swapData.source_token_amount} {tokenSymbol}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Refund Locktime</p>
            <p className="text-xs text-muted-foreground">
              {refundLocktimeDate.toLocaleString()}
              <span
                className={`ml-2 ${isLocktimePassed ? "text-green-600" : "text-orange-600"}`}
              >
                ({isLocktimePassed ? "Passed" : "Not yet reached"})
              </span>
            </p>
          </div>

          {isLoadingCallData && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <p className="text-xs text-muted-foreground">
                Loading refund data...
              </p>
            </div>
          )}
        </div>

        {/* Wallet Connection Warning */}
        {!address && (
          <Alert variant="destructive">
            <AlertDescription>
              Please connect your wallet to continue
            </AlertDescription>
          </Alert>
        )}

        {/* Refund Button */}
        {isLocktimePassed && refundCallData && (
          <Button
            onClick={handleRefund}
            disabled={isRefunding || !address || isLoadingCallData}
            className="w-full h-12 text-base font-semibold"
          >
            {isRefunding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Refund...
              </>
            ) : (
              "Refund Swap"
            )}
          </Button>
        )}

        {/* Error Display */}
        {refundError && (
          <Alert variant="destructive">
            <AlertDescription>{refundError}</AlertDescription>
          </Alert>
        )}

        {/* Success Display */}
        {refundSuccess && (
          <Alert>
            <AlertDescription>{refundSuccess}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
