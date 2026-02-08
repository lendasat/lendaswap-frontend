import { Check, Circle, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  api,
  type ArkadeToEvmSwapResponse,
  type GetSwapResponse,
} from "../../api";

interface ClaimEvmStepProps {
  swapData: GetSwapResponse;
  swapId: string;
}

export function ClaimEvmStep({ swapData, swapId }: ClaimEvmStepProps) {
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

  // Auto-claim via gasless relay when server is funded
  useEffect(() => {
    const autoClaimEvm = async () => {
      if (swapData.status !== "serverfunded") return;

      const claimKey = `swap_${swapData.id}_claim_attempted`;
      const attemptTimestamp = localStorage.getItem(claimKey);

      if (attemptTimestamp && retryCount >= maxRetries) {
        console.log("Max retries reached for this swap, stopping");
        return;
      }

      if (hasClaimedRef.current || isClaiming) return;

      hasClaimedRef.current = true;
      setIsClaiming(true);
      setClaimError(null);

      try {
        if (retryCount > 0) {
          const backoffMs = 2 ** retryCount * 1000;
          console.log(`Waiting ${backoffMs}ms before retry ${retryCount}...`);
          await sleep(backoffMs);
        }

        console.log("Auto-claiming via gasless relay:", {
          swapId: swapData.id,
          retryCount,
        });

        localStorage.setItem(claimKey, Date.now().toString());

        await api.claimGelato(swapData.id);

        console.log("Claim request sent successfully");
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
              : `Failed to claim tokens after ${maxRetries} attempts. Please try manually.`,
          );
        } else {
          setClaimError(
            error instanceof Error
              ? `${error.message} (Retrying...)`
              : `Failed to claim tokens. Retrying...`,
          );
        }

        if (newRetryCount < maxRetries) {
          localStorage.removeItem(claimKey);
          hasClaimedRef.current = false;
        }
      } finally {
        setIsClaiming(false);
      }
    };

    autoClaimEvm();
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

  // Cast for field access
  const swap = swapData as ArkadeToEvmSwapResponse & {
    direction: "arkade_to_evm";
  };

  const config = {
    step1Label: "User Funded",
    step1TxId: swap.btc_fund_txid,
    step2LabelActive: "Server Funding",
    step2LabelComplete: "Server Funded",
    step2TxId: swap.evm_fund_txid,
    step3Label: "Client Redeeming",
    step3TxId: swap.evm_claim_txid,
    step4Label: "Server Redeemed",
    step4TxId: swap.btc_claim_txid,
  };

  const isClientFundingSeen = swapData.status === "clientfundingseen";

  const getCurrentStep = () => {
    if (isClientFundingSeen) return 1;
    if (!config.step2TxId) return 2;
    if (!config.step3TxId) return 3;
    if (!config.step4TxId) return 4;
    return 5;
  };

  const currentStep = getCurrentStep();

  const renderStep = (
    stepNum: number,
    label: string,
    txId: string | null | undefined,
    activeLabel?: string,
  ) => {
    const isComplete = !!txId;
    const isActive = currentStep === stepNum;
    const displayLabel = activeLabel && !isComplete ? activeLabel : label;

    return (
      <div className="flex items-start gap-3">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            isComplete ? "bg-primary" : isActive ? "bg-muted" : "bg-muted"
          }`}
        >
          {isComplete ? (
            <Check className="h-4 w-4 text-primary-foreground" />
          ) : isActive ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <p className="font-medium">{displayLabel}</p>
          {txId && (
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground">
                {clipTxId(txId)}
              </code>
              <button
                type="button"
                onClick={() => handleCopyTxId(txId)}
                className="text-muted-foreground hover:text-foreground"
              >
                {copiedTxId === txId ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
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
      <div className="space-y-6 p-6">
        <div className="space-y-4">
          {renderStep(
            1,
            isClientFundingSeen ? "User Funding Detected" : config.step1Label,
            isClientFundingSeen ? null : config.step1TxId,
          )}
          {isClientFundingSeen && (
            <p className="text-xs text-muted-foreground ml-9">
              Transaction detected, awaiting confirmation...
            </p>
          )}

          {renderStep(
            2,
            config.step2LabelComplete,
            config.step2TxId,
            config.step2LabelActive,
          )}

          {/* Step 3: Client Redeeming - with inline claiming status */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                config.step3TxId
                  ? "bg-primary"
                  : currentStep === 3
                    ? "bg-muted"
                    : "bg-muted"
              }`}
            >
              {config.step3TxId ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : currentStep === 3 ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">{config.step3Label}</p>
              {config.step3TxId && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(config.step3TxId)}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyTxId(config.step3TxId || "")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === config.step3TxId ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
              {swapData.status === "serverfunded" && (
                <div className="from-primary/5 to-card mt-2 space-y-2 rounded-lg border bg-gradient-to-t p-4">
                  <p className="text-sm font-medium">
                    {isClaiming ? "Claiming your tokens..." : "HTLC Funded"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {isClaiming
                      ? "Submitting claim request via Gelato Relay..."
                      : "The HTLC has been funded. Preparing to claim your tokens..."}
                  </p>
                  {retryCount > 0 && retryCount < maxRetries && (
                    <p className="text-muted-foreground text-xs">
                      Retry attempt {retryCount}/{maxRetries}...
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Gas fees fully sponsored via Gelato Relay - no fees for you!
                  </p>
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

          {renderStep(4, config.step4Label, config.step4TxId)}
        </div>
      </div>
    </div>
  );
}
