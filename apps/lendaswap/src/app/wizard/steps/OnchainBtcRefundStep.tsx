import {
  OnchainToEvmSwapResponse,
  swapStatusToString,
} from "@lendasat/lendaswap-sdk";
import { ArrowRight, Clock, ExternalLink, Loader2, Unlock } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  api,
  type BtcToArkadeSwapResponse,
  getTokenNetworkName,
  getTokenSymbol,
} from "../../api";

interface OnchainBtcRefundStepProps {
  swapData: BtcToArkadeSwapResponse | OnchainToEvmSwapResponse;
  swapId: string;
}

export function OnchainBtcRefundStep({
  swapData,
  swapId,
}: OnchainBtcRefundStepProps) {
  const posthog = usePostHog();
  const [refundAddress, setRefundAddress] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);

  // Countdown timer state
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLocktimePassed = now >= swapData.btc_refund_locktime;
  const refundLocktimeDate = new Date(
    Number(swapData.btc_refund_locktime) * 1000,
  );

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    if (isLocktimePassed) return null;

    const secondsLeft = Number(swapData.btc_refund_locktime) - now;
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
  }, [now, swapData.btc_refund_locktime, isLocktimePassed]);

  // Check if swap can be refunded
  const canRefund = isLocktimePassed && swapData.btc_fund_txid !== null;

  const handleRefund = async () => {
    if (!swapId || !refundAddress.trim()) {
      setRefundError("Please enter a Bitcoin refund address");
      return;
    }

    // Basic Bitcoin address validation (P2PKH, P2SH, Bech32, Bech32m)
    const btcAddressRegex =
      /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59}|tb1[a-zA-HJ-NP-Z0-9]{39,59}|bcrt1[a-zA-HJ-NP-Z0-9]{39,59})$/;

    if (!btcAddressRegex.test(refundAddress)) {
      setRefundError("Please enter a valid Bitcoin address");
      return;
    }

    setIsRefunding(true);
    setRefundError(null);
    setRefundSuccess(null);

    try {
      const txid = await api.refundOnchainHtlc(swapId, refundAddress);
      setRefundSuccess(`Refund successful! Transaction ID: ${txid}`);

      // Track refund success
      posthog?.capture("swap_refunded", {
        swap_id: swapId,
        swap_direction: "btc-to-arkade",
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
              The refund locktime has passed. You can now refund your on-chain
              Bitcoin from this swap.
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

        {/* Swap Details */}
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Swap</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">
                {getTokenSymbol(swapData.source_token)} on{" "}
                {getTokenNetworkName(swapData.source_token)}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">
                {getTokenSymbol(swapData.target_token)} on{" "}
                {getTokenNetworkName(swapData.target_token)}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Swap Status</p>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {swapStatusToString(swapData.status)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">HTLC Address</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground font-mono break-all flex-1">
                {swapData.btc_htlc_address}
              </p>
              <a
                href={`https://mempool.space/address/${swapData.btc_htlc_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Amount Sent</p>
            <p className="text-xs text-muted-foreground">
              {swapData.source_amount.toLocaleString()} sats
            </p>
          </div>

          {swapData.btc_fund_txid && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Funding Transaction</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground font-mono">
                  {swapData.btc_fund_txid.slice(0, 16)}...
                </p>
                <a
                  href={`https://mempool.space/tx/${swapData.btc_fund_txid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

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

        {/* Refund not possible warning */}
        {!canRefund && isLocktimePassed && !swapData.btc_fund_txid && (
          <Alert>
            <AlertDescription>
              No on-chain funding transaction found. This swap may not have been
              funded yet.
            </AlertDescription>
          </Alert>
        )}

        {/* Refund Form */}
        {canRefund && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refundAddress">
                Refund Address (Bitcoin Address)
              </Label>
              <Input
                id="refundAddress"
                type="text"
                placeholder="bc1q..."
                value={refundAddress}
                onChange={(e) => setRefundAddress(e.target.value)}
                disabled={isRefunding}
              />
              <p className="text-xs text-muted-foreground">
                Enter a valid Bitcoin address to receive your refund.
              </p>
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
            <AlertDescription>
              {refundSuccess}
              {refundSuccess.includes("Transaction ID:") && (
                <a
                  href={`https://mempool.space/tx/${refundSuccess.split("Transaction ID: ")[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                >
                  View on mempool.space <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
