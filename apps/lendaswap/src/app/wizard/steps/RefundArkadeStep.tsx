import { ArrowRight, Clock, Loader2, Unlock } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { api, type VhtlcAmounts } from "../../api";
import type { ArkadeToEvmSwapResponse } from "@lendasat/lendaswap-sdk-pure";
import { DepositCard } from "../components";
import { useWalletBridge } from "../../WalletBridgeContext";

interface RefundArkadeStepProps {
  swapData: ArkadeToEvmSwapResponse;
}

export function RefundArkadeStep({ swapData }: RefundArkadeStepProps) {
  const posthog = usePostHog();
  const [refundAddress, setRefundAddress] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<VhtlcAmounts | null>(null);
  const [isLoadingAmounts, setIsLoadingAmounts] = useState(false);
  const { arkAddress } = useWalletBridge();

  // Auto-populate refund address if arkAddress is provided
  useEffect(() => {
    if (arkAddress && !refundAddress) {
      setRefundAddress(arkAddress);
    }
  }, [arkAddress, refundAddress]);

  // Fetch amounts once
  useEffect(() => {
    if (amounts !== null) return;

    const fetchAmounts = async () => {
      setIsLoadingAmounts(true);
      try {
        const fetchedAmounts = await api.amountsForSwap(swapData.id);
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
  }, [swapData, amounts]);

  // Calculate if swap can be refunded (spendable or recoverable VTXOs after locktime)
  const canRefund = (() => {
    if (!swapData || amounts === null) return false;

    const now = Math.floor(Date.now() / 1000);
    const hasRefundableAmount =
      amounts.spendable > 0 || amounts.recoverable > 0;
    const isLocktimePassed = now >= swapData.vhtlc_refund_locktime;

    return hasRefundableAmount && isLocktimePassed;
  })();

  const refundLocktimeDate = new Date(swapData.vhtlc_refund_locktime * 1000);

  // Countdown timer state
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLocktimePassed = now >= swapData.vhtlc_refund_locktime;

  const timeRemaining = useMemo(() => {
    if (isLocktimePassed) return null;

    const secondsLeft = swapData.vhtlc_refund_locktime - now;
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
  }, [now, swapData.vhtlc_refund_locktime, isLocktimePassed]);

  const handleRefund = async () => {
    if (!refundAddress.trim()) {
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
      const txid = await api.refundVhtlc(swapData.id, refundAddress);
      setRefundSuccess(`Refund successful! Transaction ID: ${txid}`);

      posthog?.capture("swap_refunded", {
        swap_id: swapData.id,
        swap_direction: "arkade-to-evm",
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

  const alreadyRefunded = amounts !== null && amounts.vtxoStatus === "spent";

  const sourceSymbol = swapData.source_token.symbol;
  const targetSymbol = swapData.target_token.symbol;

  return (
    <DepositCard
      sourceToken={swapData.source_token}
      targetToken={swapData.target_token}
      swapId={swapData.id}
      title={`Refund ${swapData.source_token.symbol} → ${swapData.target_token.symbol}`}
    >
      <div className="space-y-6">
        {/* Refund Status Banner */}
        {alreadyRefunded && (
          <div className="space-y-3 rounded-lg border border-green-500 bg-green-50 p-4 dark:bg-green-950/20">
            <div className="flex items-center gap-3">
              <Unlock className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                Already Refunded
              </h3>
            </div>
            <p className="text-sm text-green-800 dark:text-green-200">
              This swap has already been refunded
            </p>
          </div>
        )}

        {!alreadyRefunded && isLocktimePassed && (
          <div className="space-y-3 rounded-lg border border-green-500 bg-green-50 p-4 dark:bg-green-950/20">
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
        )}
        {!alreadyRefunded && !isLocktimePassed && (
          <div className="space-y-3 rounded-lg border border-orange-500 bg-orange-50 p-4 dark:bg-orange-950/20">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                Refund Locked
              </h3>
            </div>
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Your funds are temporarily locked. Refund will be available in:
            </p>
            <div className="font-mono text-2xl font-bold text-orange-900 dark:text-orange-100">
              {timeRemaining}
            </div>
          </div>
        )}

        {/* Swap Details */}
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Swap</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{sourceSymbol}</span>
              <ArrowRight className="text-muted-foreground h-3 w-3" />
              <span className="text-xs font-medium">{targetSymbol}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Swap Status</p>
            <p className="text-muted-foreground break-all font-mono text-xs">
              {swapData.status}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">VHTLC Address</p>
            <p className="text-muted-foreground break-all font-mono text-xs">
              {swapData.btc_vhtlc_address}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">VHTLC Status</p>
            {isLoadingAmounts ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <p className="text-muted-foreground text-xs">Loading...</p>
              </div>
            ) : amounts !== null ? (
              <div className="space-y-1">
                {amounts.vtxoStatus === "not_funded" && (
                  <p className="text-muted-foreground text-xs">
                    Not yet funded
                  </p>
                )}
                {amounts.vtxoStatus === "spendable" && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {amounts.spendable.toLocaleString()} sats — spendable
                  </p>
                )}
                {amounts.vtxoStatus === "recoverable" && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    {amounts.recoverable.toLocaleString()} sats — recoverable
                    (batch expired)
                  </p>
                )}
                {amounts.vtxoStatus === "mixed" && (
                  <>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {amounts.spendable.toLocaleString()} sats — spendable
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      {amounts.recoverable.toLocaleString()} sats — recoverable
                      (batch expired)
                    </p>
                  </>
                )}
                {amounts.vtxoStatus === "spent" && (
                  <p className="text-muted-foreground text-xs">
                    {amounts.spent.toLocaleString()} sats — already spent
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">Unknown</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Refund Locktime</p>
            <p className="text-muted-foreground text-xs">
              {refundLocktimeDate.toLocaleString()}
              <span
                className={`ml-2 ${isLocktimePassed ? "text-green-600" : "text-orange-600"}`}
              >
                ({isLocktimePassed ? "Passed" : "Not yet reached"})
              </span>
            </p>
          </div>
        </div>

        {/* Refund not available warning */}
        {!canRefund && amounts !== null && isLocktimePassed && (
          <Alert>
            <AlertDescription>
              {amounts.vtxoStatus === "spent"
                ? "This VHTLC has already been refunded."
                : amounts.vtxoStatus === "not_funded"
                  ? "No funds found at this VHTLC address."
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
              className="h-12 w-full text-base font-semibold"
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
    </DepositCard>
  );
}
