import type { VhtlcAmounts } from "@lendasat/lendaswap-sdk";
import { ArrowRight, Clock, Loader2, Unlock } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  api,
  type BtcToEvmSwapResponse,
  getTokenDisplayName,
  getTokenIcon,
} from "../../api";

interface BtcToPolygonRefundStepProps {
  swapData: BtcToEvmSwapResponse;
  swapId: string;
  arkAddress?: string | null;
}

export function BtcToPolygonRefundStep({
  swapData,
  swapId,
  arkAddress,
}: BtcToPolygonRefundStepProps) {
  const posthog = usePostHog();
  const [refundAddress, setRefundAddress] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<VhtlcAmounts | null>(null);
  const [isLoadingAmounts, setIsLoadingAmounts] = useState(false);

  // Auto-populate refund address if arkAddress is provided
  useEffect(() => {
    if (arkAddress && !refundAddress) {
      setRefundAddress(arkAddress);
    }
  }, [arkAddress, refundAddress]);

  // Fetch amounts once wallet is ready
  useEffect(() => {
    if (!swapId || amounts !== null) return;

    const fetchAmounts = async () => {
      setIsLoadingAmounts(true);
      try {
        const fetchedAmounts = await api.amountsForSwap(swapId);
        setAmounts(fetchedAmounts);
      } catch (error) {
        console.error("Failed to fetch amounts:", error);
        setRefundError(
          `Failed to fetch amounts: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsLoadingAmounts(false);
      }
    };

    fetchAmounts();
  }, [swapId, amounts]);

  // Calculate if swap can be refunded
  const canRefund = (() => {
    if (!swapData || amounts === null) return false;

    const now = Math.floor(Date.now() / 1000);
    console.log(
      `Amounts ${amounts.spendable}, ${amounts.spent}, ${amounts.recoverable}`,
    );

    const hasSpendableAmount = amounts.spendable > 0;
    const isLocktimePassed = now >= swapData.refund_locktime;

    return hasSpendableAmount && isLocktimePassed;
  })();

  const refundLocktimeDate = new Date(swapData.refund_locktime * 1000);

  // Countdown timer state
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLocktimePassed = now >= swapData.refund_locktime;

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    if (isLocktimePassed) return null;

    const secondsLeft = swapData.refund_locktime - now;
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
  }, [now, swapData.refund_locktime, isLocktimePassed]);

  const handleRefund = async () => {
    if (!swapId || !refundAddress.trim()) {
      setRefundError("Please enter a refund address");
      return;
    }

    if (!refundAddress.startsWith("tark") && !refundAddress.startsWith("ark")) {
      setRefundError("Please enter a valid Arkade address");
      return;
    }

    setIsRefunding(true);
    setRefundError(null);
    setRefundSuccess(null);

    try {
      const txid = await api.refundVhtlc(swapId, refundAddress);
      setRefundSuccess(`Refund successful! Transaction ID: ${txid}`);

      // Track refund success
      posthog?.capture("swap_refunded", {
        swap_id: swapId,
        swap_direction: "btc-to-polygon",
        refund_reason: "user_initiated",
        refund_txid: txid,
      });
    } catch (error) {
      console.error("Refund failed:", error);
      setRefundError(
        error instanceof Error
          ? error.message
          : "Failed to refund swap. Check the logs or try again later.",
      );
    } finally {
      setIsRefunding(false);
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
              The refund locktime has passed. You can now refund your Bitcoin
              from this swap.
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

        {/* VHTLC Details */}
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Swap</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-5 h-5 bg-muted rounded-full p-0.5">
                  {getTokenIcon(swapData.source_token)}
                </div>
                <span className="text-xs font-medium">
                  {getTokenDisplayName(swapData.source_token)}
                </span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-5 h-5 bg-muted rounded-full p-0.5">
                  {getTokenIcon(swapData.target_token)}
                </div>
                <span className="text-xs font-medium">
                  {getTokenDisplayName(swapData.target_token)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground ml-2">
                (${swapData.asset_amount.toString()})
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Swap Status</p>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {swapData.status}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">VHTLC Address</p>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {swapData.htlc_address_arkade}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">VHTLC Amounts</p>
            {isLoadingAmounts ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <p className="text-xs text-muted-foreground">Loading...</p>
              </div>
            ) : amounts !== null ? (
              <div className="space-y-1">
                {amounts.spendable > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Spendable: {amounts.spendable.toLocaleString()} sats
                  </p>
                )}
                {amounts.spent > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Spent: {amounts.spent.toLocaleString()} sats
                  </p>
                )}
                {amounts.recoverable > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Recoverable: {amounts.recoverable.toLocaleString()} sats
                  </p>
                )}
                {amounts.spendable === 0n &&
                  amounts.spent === 0n &&
                  amounts.recoverable === 0n && (
                    <p className="text-xs text-muted-foreground">
                      Not yet funded
                    </p>
                  )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Unknown</p>
            )}
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
        </div>

        {/* Refund not available warning (only show for non-locktime issues) */}
        {!canRefund && amounts !== null && isLocktimePassed && (
          <Alert>
            <AlertDescription>
              {amounts.spent > 0 && amounts.spendable === 0n
                ? "This VHTLC has already been refunded."
                : amounts.spendable === 0n
                  ? "No spendable funds available for this swap."
                  : "This swap cannot be refunded at this time."}
            </AlertDescription>
          </Alert>
        )}

        {/* Refund Form */}
        {canRefund && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refundAddress">
                Refund Address (Arkade Address)
              </Label>
              <Input
                id="refundAddress"
                type="text"
                placeholder="ark1..."
                value={refundAddress}
                onChange={(e) => setRefundAddress(e.target.value)}
                disabled={isRefunding || !!arkAddress}
                className={arkAddress ? "cursor-not-allowed opacity-60" : ""}
              />
            </div>

            <Button
              onClick={handleRefund}
              disabled={isRefunding || !refundAddress.trim() || !canRefund}
              className="w-full h-12 text-base font-semibold"
            >
              {isRefunding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refunding...
                </>
              ) : (
                "Refund Swap"
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
    </div>
  );
}
