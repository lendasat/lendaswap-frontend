import {
  type EvmToArkadeSwapResponse,
  type EvmToBitcoinSwapResponse,
  type EvmToLightningSwapResponse,
  toChainName,
} from "@lendasat/lendaswap-sdk-pure";
import { useModal } from "connectkit";
import { ArrowRight, Clock, Loader2, Unlock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { publicActions } from "viem";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { api } from "../../api";
import { getViemChain } from "../../utils/tokenUtils";
import { DepositCard } from "../components";

interface RefundEvmStepProps {
  swapData:
    | EvmToBitcoinSwapResponse
    | EvmToArkadeSwapResponse
    | EvmToLightningSwapResponse;
}

type RefundMode = "swap-back" | "direct";

function formatAmount(raw: number | string, decimals: number): string {
  return (Number(raw) / 10 ** decimals).toFixed(decimals);
}

export function RefundEvmStep({ swapData }: RefundEvmStepProps) {
  const { address } = useAccount();
  const { setOpen } = useModal();

  const swapId = swapData.id;
  const chain = getViemChain(swapData.source_token.chain);

  const { data: walletClient } = useWalletClient({ chainId: chain?.id });
  const walletPublicClient = walletClient?.extend(publicActions);
  const { switchChainAsync } = useSwitchChain();

  const [isRefunding, setIsRefunding] = useState(false);
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

  // WBTC amount locked in the HTLC for this specific swap (8 decimals)
  const lockedWbtcFormatted = formatAmount(swapData.evm_expected_sats, 8);

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
    // For WBTC source, only direct mode makes sense (no swap needed)
    fetchRefundCallData(isWbtcSource ? "direct" : "swap-back");
  }, [swapId, isWbtcSource, refundCallData, fetchRefundCallData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefund = async (mode: RefundMode) => {
    if (!address) {
      setOpen(true);
      return;
    }
    if (!walletClient || !walletPublicClient) {
      setOpen(true);
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
      // Switch to the correct chain
      await switchChainAsync({ chainId: chain.id });

      // Fetch fresh calldata for the chosen mode
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
    } catch (err) {
      console.error("Refund error:", err);
      setRefundError(
        err instanceof Error ? err.message : "Failed to execute refund",
      );
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <DepositCard
      sourceToken={swapData.source_token}
      targetToken={swapData.target_token}
      swapId={swapId}
      title={`Refund ${swapData.source_token.symbol} → ${swapData.target_token.symbol}`}
    >
      <div className="space-y-6">
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
              The refund locktime has passed. You can now refund your funds from
              this swap.
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
                ({sourceAmount} {sourceSymbol} on{" "}
                {toChainName(swapData.source_token.chain)})
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">HTLC Address</p>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {swapData.evm_htlc_address}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Locked in HTLC</p>
            <p className="text-xs text-muted-foreground">
              {lockedWbtcFormatted} WBTC
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

        {/* Refund Buttons */}
        {isLocktimePassed && (
          <div className="flex flex-col gap-3">
            {!isWbtcSource && (
              <p className="text-xs text-muted-foreground">
                Your {sourceSymbol} was swapped to WBTC before locking in the
                HTLC. Refunding as {sourceSymbol} involves swapping WBTC back
                via a DEX and is subject to the current exchange rate. You may
                receive slightly more or less than your original amount.
                Alternatively, you can refund as WBTC directly.
              </p>
            )}

            {!isWbtcSource && (
              <Button
                onClick={() => handleRefund("swap-back")}
                disabled={isRefunding || !address || isLoadingCallData}
                className="w-full h-12 text-base font-semibold bg-black text-white hover:bg-black/90"
              >
                {isRefunding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Refund...
                  </>
                ) : (
                  `Refund as ${sourceSymbol}`
                )}
              </Button>
            )}

            <Button
              onClick={() => handleRefund("direct")}
              disabled={isRefunding || !address || isLoadingCallData}
              variant={isWbtcSource ? "default" : "outline"}
              className={`w-full h-12 text-base font-semibold ${isWbtcSource ? "bg-black text-white hover:bg-black/90" : ""}`}
            >
              {isRefunding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Refund...
                </>
              ) : (
                `Refund as WBTC`
              )}
            </Button>
          </div>
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
    </DepositCard>
  );
}
