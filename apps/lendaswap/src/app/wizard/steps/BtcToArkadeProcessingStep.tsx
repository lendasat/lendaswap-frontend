import { Check, Circle, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { api, type BtcToArkadeSwapResponse, SwapStatus } from "../../api";

interface BtcToArkadeProcessingStepProps {
  swapData: BtcToArkadeSwapResponse;
  swapId: string;
  preimage: string | null;
}

export function BtcToArkadeProcessingStep({
  swapData,
  swapId,
}: BtcToArkadeProcessingStepProps) {
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const hasClaimedRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 10;

  const sleep = useCallback(
    (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    [],
  );

  const handleManualRetry = async () => {
    setRetryCount(0);
    setClaimError(null);
    hasClaimedRef.current = false;
    const claimKey = `swap_${swapData.id}_claim_attempted`;
    localStorage.removeItem(claimKey);
  };

  // Auto-claim when server has funded the Arkade VHTLC
  useEffect(() => {
    const autoClaimArkadeVhtlc = async () => {
      // Only claim when server has funded the VHTLC
      if (swapData.status !== SwapStatus.ServerFunded) return;

      const claimKey = `swap_${swapData.id}_claim_attempted`;
      const attemptTimestamp = localStorage.getItem(claimKey);

      // Check if we've exhausted retries
      if (attemptTimestamp && retryCount >= maxRetries) {
        console.log("Max retries reached for this swap, stopping");
        return;
      }

      if (hasClaimedRef.current || isClaiming) return;

      hasClaimedRef.current = true;
      setIsClaiming(true);
      setClaimError(null);

      try {
        // Exponential backoff: wait before retry
        if (retryCount > 0) {
          const backoffMs = 2 ** retryCount * 1000;
          console.log(`Waiting ${backoffMs}ms before retry ${retryCount}...`);
          await sleep(backoffMs);
        }

        console.log("Auto-claiming Arkade VHTLC with parameters:", {
          swapId: swapData.id,
          retryCount,
        });

        // Mark that we've attempted to claim
        localStorage.setItem(claimKey, Date.now().toString());

        // Claim the Arkade VHTLC
        const txid = await api.claimBtcToArkadeVhtlc(swapData.id);
        console.log(`Claim request sent successfully: ${txid}`);
        // Success! Reset retry count
        setRetryCount(0);
      } catch (error) {
        console.error(
          `Failed to auto-claim (attempt ${retryCount + 1}/${maxRetries}):`,
          error,
        );
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);

        if (newRetryCount >= maxRetries) {
          setClaimError(
            error instanceof Error
              ? `${error.message} (Max retries reached)`
              : `Failed to claim sats after ${maxRetries} attempts. Please try manually.`,
          );
        } else {
          setClaimError(
            error instanceof Error
              ? `${error.message} (Retrying...)`
              : `Failed to claim sats. Retrying...`,
          );
        }

        // Only remove localStorage flag if we haven't exhausted retries
        if (newRetryCount < maxRetries) {
          localStorage.removeItem(claimKey);
          hasClaimedRef.current = false;
        }
      } finally {
        setIsClaiming(false);
      }
    };

    autoClaimArkadeVhtlc();
  }, [swapData, isClaiming, retryCount, sleep]);

  const handleCopyTxId = async (txId: string) => {
    try {
      await navigator.clipboard.writeText(txId);
      setCopiedTxId(txId);
      setTimeout(() => setCopiedTxId(null), 2000);
    } catch (err) {
      console.error("Failed to copy transaction ID:", err);
    }
  };

  const clipTxId = (txId: string) => {
    return `${txId.slice(0, 8)}...${txId.slice(-8)}`;
  };

  // Determine current step based on transaction IDs and status
  const getCurrentStep = () => {
    if (!swapData.btc_fund_txid) return 1; // Waiting for on-chain funding
    // ClientFundingSeen means tx is seen but not confirmed - still step 1
    if (swapData.status === SwapStatus.ClientFundingSeen) return 1;
    if (!swapData.arkade_fund_txid) return 2; // Server funding VHTLC
    if (!swapData.arkade_claim_txid) return 3; // User claiming VHTLC
    if (!swapData.btc_claim_txid) return 4; // Server claiming on-chain
    return 5; // All complete
  };

  const isFundingSeen = swapData.status === SwapStatus.ClientFundingSeen;

  const currentStep = getCurrentStep();

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
      <div className="space-y-6 p-6">
        <div className="space-y-4">
          {/* Step 1: On-chain Bitcoin Funded */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                swapData.btc_fund_txid && !isFundingSeen
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            >
              {swapData.btc_fund_txid && !isFundingSeen ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : currentStep === 1 ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">
                {isFundingSeen
                  ? "Waiting for Confirmations"
                  : swapData.btc_fund_txid
                    ? "On-chain Bitcoin Received"
                    : "Waiting for On-chain Payment"}
              </p>
              {isFundingSeen && (
                <p className="text-xs text-muted-foreground">
                  Transaction detected, waiting for confirmation...
                </p>
              )}
              {swapData.btc_fund_txid && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(swapData.btc_fund_txid)}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyTxId(swapData.btc_fund_txid || "")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === swapData.btc_fund_txid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  <a
                    href={`https://mempool.space/tx/${swapData.btc_fund_txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Server Funding Arkade VHTLC */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                swapData.arkade_fund_txid ? "bg-primary" : "bg-muted"
              }`}
            >
              {swapData.arkade_fund_txid ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : currentStep === 2 ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">
                {swapData.arkade_fund_txid
                  ? "Arkade VHTLC Funded"
                  : "Server Funding Arkade VHTLC"}
              </p>
              {swapData.arkade_fund_txid && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(swapData.arkade_fund_txid)}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyTxId(swapData.arkade_fund_txid || "")
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === swapData.arkade_fund_txid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: User Claiming Arkade VHTLC */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                swapData.arkade_claim_txid ? "bg-primary" : "bg-muted"
              }`}
            >
              {swapData.arkade_claim_txid ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : currentStep === 3 ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">
                {swapData.arkade_claim_txid
                  ? "Arkade Funds Claimed"
                  : "Claiming Arkade Funds"}
              </p>
              {swapData.arkade_claim_txid && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(swapData.arkade_claim_txid)}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyTxId(swapData.arkade_claim_txid || "")
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === swapData.arkade_claim_txid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
              {/* Show claiming status when server has funded */}
              {swapData.status === SwapStatus.ServerFunded && (
                <div className="from-primary/5 to-card mt-2 space-y-2 rounded-lg border bg-gradient-to-t p-4">
                  <p className="text-sm font-medium">
                    {isClaiming
                      ? "Claiming your Arkade funds..."
                      : "VHTLC Ready to Claim"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {isClaiming
                      ? "Claiming the Arkade VHTLC with your secret..."
                      : "The VHTLC has been funded. Preparing to claim your sats..."}
                  </p>
                  {retryCount > 0 && retryCount < maxRetries && (
                    <p className="text-muted-foreground text-xs">
                      Retry attempt {retryCount}/{maxRetries}...
                    </p>
                  )}
                  {claimError && (
                    <div className="space-y-2">
                      <div className="bg-destructive/10 text-destructive rounded-lg p-2 text-xs">
                        {claimError}
                      </div>
                      {retryCount >= maxRetries && (
                        <Button
                          onClick={handleManualRetry}
                          size="sm"
                          variant="outline"
                          className="w-full"
                        >
                          Retry Manually
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Server Claiming On-chain Bitcoin */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                swapData.btc_claim_txid ? "bg-primary" : "bg-muted"
              }`}
            >
              {swapData.btc_claim_txid ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : currentStep === 4 ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">
                {swapData.btc_claim_txid
                  ? "Swap Complete"
                  : "Server Claiming On-chain Bitcoin"}
              </p>
              {swapData.btc_claim_txid && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(swapData.btc_claim_txid)}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyTxId(swapData.btc_claim_txid || "")
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === swapData.btc_claim_txid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  <a
                    href={`https://mempool.space/tx/${swapData.btc_claim_txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
