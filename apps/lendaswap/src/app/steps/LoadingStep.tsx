import { useState } from "react";
import { CardContent } from "#/components/ui/card";
import { Button } from "#/components/ui/button";
import { type SwapStatus } from "../api";

interface LoadingStepProps {
  status: SwapStatus;
  swapId?: string;
}

export function LoadingStep({ status, swapId }: LoadingStepProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async () => {
    if (!swapId) return;

    try {
      await navigator.clipboard.writeText(swapId);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  // Determine which steps are complete
  const isPending = status === "pending";
  const isClientFunded =
    status === "clientfunded" ||
    status === "serverfunded" ||
    status === "clientredeemed" ||
    status === "serverredeemed";
  const isServerFunded =
    status === "serverfunded" ||
    status === "clientredeemed" ||
    status === "serverredeemed";
  const isClientRedeemed =
    status === "clientredeemed" || status === "serverredeemed";
  const isServerRedeemed = status === "serverredeemed";

  return (
    <CardContent className="py-12">
      <div className="flex flex-col items-center space-y-6">
        {/* Loading Spinner */}
        {!isServerRedeemed && (
          <div className="border-muted border-t-foreground h-16 w-16 animate-spin rounded-full border-4" />
        )}

        {/* Status Messages */}
        <div className="space-y-2 text-center">
          <h3 className="text-lg font-semibold">
            {isServerRedeemed
              ? "Swap Complete!"
              : isPending
                ? "Waiting for Payment"
                : "Processing Your Swap"}
          </h3>
          <p className="text-muted-foreground text-sm">
            {isServerRedeemed
              ? "Your swap has been completed successfully"
              : isPending
                ? "Waiting for BTC payment"
                : "Verifying payment and preparing USDC transfer"}
          </p>
        </div>

        {/* Swap ID Display */}
        {swapId && (
          <div className="bg-muted/50 w-full max-w-md rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 overflow-hidden">
                <p className="text-muted-foreground text-xs font-medium">
                  Swap ID
                </p>
                <p className="font-mono text-sm truncate">{swapId}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copySuccess ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mt-4 w-full max-w-md space-y-3">
          {/* Step 1: BTC Funded */}
          <div
            className={`flex items-center gap-3 text-sm ${isClientFunded ? "" : "text-muted-foreground"}`}
          >
            {isClientFunded ? (
              <div className="bg-foreground text-background flex h-5 w-5 items-center justify-center rounded-full text-xs">
                ✓
              </div>
            ) : (
              <div
                className={`h-5 w-5 rounded-full border-2 ${isPending ? "border-foreground animate-pulse" : "border-muted"}`}
              />
            )}
            <span>BTC payment received</span>
          </div>

          {/* Step 2: Server Funded HTLC */}
          <div
            className={`flex items-center gap-3 text-sm ${isServerFunded ? "" : "text-muted-foreground"}`}
          >
            {isServerFunded ? (
              <div className="bg-foreground text-background flex h-5 w-5 items-center justify-center rounded-full text-xs">
                ✓
              </div>
            ) : (
              <div
                className={`h-5 w-5 rounded-full border-2 ${isClientFunded && !isServerFunded ? "border-foreground animate-pulse" : "border-muted"}`}
              />
            )}
            <span>HTLC locked on Polygon</span>
          </div>

          {/* Step 3: Client Redeemed */}
          <div
            className={`flex items-center gap-3 text-sm ${isClientRedeemed ? "" : "text-muted-foreground"}`}
          >
            {isClientRedeemed ? (
              <div className="bg-foreground text-background flex h-5 w-5 items-center justify-center rounded-full text-xs">
                ✓
              </div>
            ) : (
              <div
                className={`h-5 w-5 rounded-full border-2 ${isServerFunded && !isClientRedeemed ? "border-foreground animate-pulse" : "border-muted"}`}
              />
            )}
            <span>USDC claimed</span>
          </div>

          {/* Step 4: Server Redeemed */}
          <div
            className={`flex items-center gap-3 text-sm ${isServerRedeemed ? "" : "text-muted-foreground"}`}
          >
            {isServerRedeemed ? (
              <div className="bg-foreground text-background flex h-5 w-5 items-center justify-center rounded-full text-xs">
                ✓
              </div>
            ) : (
              <div
                className={`h-5 w-5 rounded-full border-2 ${isClientRedeemed && !isServerRedeemed ? "border-foreground animate-pulse" : "border-muted"}`}
              />
            )}
            <span>Swap finalized</span>
          </div>
        </div>
      </div>
    </CardContent>
  );
}
