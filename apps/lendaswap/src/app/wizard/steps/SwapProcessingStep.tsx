import type { GetSwapResponse } from "@lendasat/lendaswap-sdk-pure";
import { useModal } from "connectkit";
import { Check, Circle, Copy, ExternalLink, Loader2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "#/components/ui/button";
import { api } from "../../api";
import {
  getBlockexplorerTxLink,
  getTokenIcon,
  getTokenNetworkIcon,
  isEthereumToken,
} from "../../utils/tokenUtils";

/** Directions where the user sends BTC and receives EVM tokens (auto-claim applies) */
function isBtcToEvmDirection(direction: GetSwapResponse["direction"]): boolean {
  return (
    direction === "bitcoin_to_evm" ||
    direction === "arkade_to_evm" ||
    direction === "lightning_to_evm"
  );
}

/** Directions where the user sends EVM and receives BTC */
function isEvmToBtcDirection(direction: GetSwapResponse["direction"]): boolean {
  return (
    direction === "evm_to_arkade" ||
    direction === "evm_to_bitcoin" ||
    direction === "evm_to_lightning"
  );
}

interface ConfirmingDepositStepProps {
  swapData: GetSwapResponse;
  swapId: string;
}

export function SwapProcessingStep({
  swapData,
  swapId,
}: ConfirmingDepositStepProps) {
  const posthog = usePostHog();
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const hasClaimedRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 10;

  // Wallet client hooks for Ethereum claiming
  const { address } = useAccount();
  const { setOpen } = useModal();

  // Helper function to sleep
  const sleep = useCallback(
    (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    [],
  );

  // Manual retry handler
  const handleManualRetry = async () => {
    setRetryCount(0);
    setClaimError(null);
    hasClaimedRef.current = false;
    const claimKey = `swap_${swapData.id}_claim_attempted`;
    localStorage.removeItem(claimKey);
  };

  // Auto-claim when server is funded (works for all directions via api.claim)
  useEffect(() => {
    const autoClaimEvmSwap = async () => {
      // Lightning-to-evm is claimed by the lightning client, skip auto-claim
      if (swapData.direction === "evm_to_lightning") return;
      if (swapData.status !== "serverfunded") return;

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
        // Exponential backoff: wait before retry (0s, 2s, 4s, 8s)
        if (retryCount > 0) {
          const backoffMs = 2 ** retryCount * 1000;
          console.log(`Waiting ${backoffMs}ms before retry ${retryCount}...`);
          await sleep(backoffMs);
        }

        console.log("Auto-claiming with parameters:", {
          swapId: swapData.id,
          retryCount,
        });

        await api.claim(swapId);

        console.log("Claim request sent successfully");
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
          const errorMessage =
            error instanceof Error
              ? `${error.message} (Max retries reached)`
              : `Failed to claim tokens after ${maxRetries} attempts. Please try manually.`;
          setClaimError(errorMessage);

          posthog?.capture("swap_failed", {
            failure_type: "claim",
            swap_id: swapData.id,
            swap_direction: swapData.direction,
            error_message: errorMessage,
            retry_count: newRetryCount,
          });
        } else {
          setClaimError(
            error instanceof Error
              ? `${error.message} (Retrying...)`
              : `Failed to claim tokens. Retrying...`,
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

    autoClaimEvmSwap();
  }, [swapData, swapId, isClaiming, retryCount, sleep, posthog?.capture]);

  // Auto-claim for evm-to-btc when server is funded
  //   fixme: implement auto claim
  //   useEffect(() => {
  //     const autoClaimPolygonToArkadeSwaps = async () => {
  //
  //       /*
  //       const polygonToBtcSwapData = swapData as EvmToBtcSwapResponse;
  //       if (swapDirection !== "evm-to-btc") return;
  //       if (isLightning(polygonToBtcSwapData.target_token)) {
  //         // this will be claimed by the lightning client
  //         return;
  //       }
  //       if (polygonToBtcSwapData.status !== "serverfunded") return;
  //       if (!polygonToBtcSwapData.user_address_arkade) {
  //         console.error("No user address for arkade provided");
  //         setClaimError("Missing Arkade address for claim");
  //         return;
  //       }
  //
  //       const claimKey = `swap_${polygonToBtcSwapData.id}_claim_attempted`;
  //       const attemptTimestamp = localStorage.getItem(claimKey);
  //
  //       // Check if we've exhausted retries
  //       if (attemptTimestamp && retryCount >= maxRetries) {
  //         console.log("Max retries reached for this swap, stopping");
  //         return;
  //       }
  //
  //       if (hasClaimedRef.current || isClaiming) return;
  //
  //       hasClaimedRef.current = true;
  //       setIsClaiming(true);
  //       setClaimError(null);
  //
  //       try {
  //         // Exponential backoff: wait before retry (0s, 2s, 4s, 8s)
  //         if (retryCount > 0) {
  //           const backoffMs = 2 ** retryCount * 1000;
  //           console.log(`Waiting ${backoffMs}ms before retry ${retryCount}...`);
  //           await sleep(backoffMs);
  //         }
  //
  //         console.log("Auto-claiming with parameters:", {
  //           swapId: polygonToBtcSwapData.id,
  //           retryCount,
  //         });
  //
  //         // Mark that we've attempted to claim
  //         localStorage.setItem(claimKey, Date.now().toString());
  //
  //         const txid = await api.claimVhtlc(polygonToBtcSwapData.id);
  //         console.log(`Claim request sent successfully ${txid}`);
  //         // Success! Reset retry count
  //         setRetryCount(0);
  //       } catch (error) {
  //         console.error(
  //           `Failed to auto-claim (attempt ${retryCount + 1}/${maxRetries}):`,
  //           error,
  //         );
  //         const newRetryCount = retryCount + 1;
  //         setRetryCount(newRetryCount);
  //
  //         if (newRetryCount >= maxRetries) {
  //           const errorMessage =
  //             error instanceof Error
  //               ? `${error.message} (Max retries reached)`
  //               : `Failed to claim sats after ${maxRetries} attempts. Please try manually.`;
  //           setClaimError(errorMessage);
  //
  //           posthog?.capture("swap_failed", {
  //             failure_type: "claim",
  //             swap_id: polygonToBtcSwapData.id,
  //             swap_direction: "evm-to-btc",
  //             error_message: errorMessage,
  //             retry_count: newRetryCount,
  //           });
  //         } else {
  //           setClaimError(
  //             error instanceof Error
  //               ? `${error.message} (Retrying...)`
  //               : `Failed to claim sats. Retrying...`,
  //           );
  //         }
  //
  //         // Only remove localStorage flag if we haven't exhausted retries
  //         if (newRetryCount < maxRetries) {
  //           localStorage.removeItem(claimKey);
  //           hasClaimedRef.current = false;
  //         }
  //       } finally {
  //         setIsClaiming(false);
  //       }
  // */
  //     };
  //
  //     autoClaimPolygonToArkadeSwaps();
  //   }, [
  //     swapData,
  //     swapDirection,
  //     isClaiming,
  //     retryCount,
  //     sleep,
  //     posthog?.capture,
  //   ]);

  // Auto-claim for bitcoin-to-arkade when server is funded
  //   fixme: implement auto claim
  // useEffect(() => {
  //   const autoClaimBtcToArkadeSwaps = async () => {
  //     if (swapDirection !== "evm-to-btc") return;
  //     const bitcoinToArkadeSwapData = swapData as BtcToArkadeSwapResponse;
  //     if (bitcoinToArkadeSwapData.status !== "serverfunded") return;
  //     if (!bitcoinToArkadeSwapData.target_arkade_address) {
  //       console.error("No user address for arkade provided");
  //       setClaimError("Missing Arkade address for claim");
  //       return;
  //     }
  //
  //     const claimKey = `swap_${bitcoinToArkadeSwapData.id}_claim_attempted`;
  //     const attemptTimestamp = localStorage.getItem(claimKey);
  //
  //     // Check if we've exhausted retries
  //     if (attemptTimestamp && retryCount >= maxRetries) {
  //       console.log("Max retries reached for this swap, stopping");
  //       return;
  //     }
  //
  //     if (hasClaimedRef.current || isClaiming) return;
  //
  //     hasClaimedRef.current = true;
  //     setIsClaiming(true);
  //     setClaimError(null);
  //
  //     try {
  //       // Exponential backoff: wait before retry (0s, 2s, 4s, 8s)
  //       if (retryCount > 0) {
  //         const backoffMs = 2 ** retryCount * 1000;
  //         console.log(`Waiting ${backoffMs}ms before retry ${retryCount}...`);
  //         await sleep(backoffMs);
  //       }
  //
  //       console.log("Auto-claiming with parameters:", {
  //         swapId: bitcoinToArkadeSwapData.id,
  //         retryCount,
  //       });
  //
  //       // Mark that we've attempted to claim
  //       localStorage.setItem(claimKey, Date.now().toString());
  //
  //       const txid = await api.claimBtcToArkadeVhtlc(
  //         bitcoinToArkadeSwapData.id,
  //       );
  //       console.log(`Claim request sent successfully ${txid}`);
  //       // Success! Reset retry count
  //       setRetryCount(0);
  //     } catch (error) {
  //       console.error(
  //         `Failed to auto-claim (attempt ${retryCount + 1}/${maxRetries}):`,
  //         error,
  //       );
  //       const newRetryCount = retryCount + 1;
  //       setRetryCount(newRetryCount);
  //
  //       if (newRetryCount >= maxRetries) {
  //         const errorMessage =
  //           error instanceof Error
  //             ? `${error.message} (Max retries reached)`
  //             : `Failed to claim sats after ${maxRetries} attempts. Please try manually.`;
  //         setClaimError(errorMessage);
  //
  //         posthog?.capture("swap_failed", {
  //           failure_type: "claim",
  //           swap_id: bitcoinToArkadeSwapData.id,
  //           swap_direction: "btc-to-arkade",
  //           error_message: errorMessage,
  //           retry_count: newRetryCount,
  //         });
  //       } else {
  //         setClaimError(
  //           error instanceof Error
  //             ? `${error.message} (Retrying...)`
  //             : `Failed to claim sats. Retrying...`,
  //         );
  //       }
  //
  //       // Only remove localStorage flag if we haven't exhausted retries
  //       if (newRetryCount < maxRetries) {
  //         localStorage.removeItem(claimKey);
  //         hasClaimedRef.current = false;
  //       }
  //     } finally {
  //       setIsClaiming(false);
  //     }
  //   };
  //
  //   autoClaimBtcToArkadeSwaps();
  // }, [
  //   swapData,
  //   swapDirection,
  //   isClaiming,
  //   retryCount,
  //   sleep,
  //   posthog?.capture,
  // ]);

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

  // Define field mappings and labels based on swap direction
  const getConfig = () => {
    switch (swapData.direction) {
      case "btc_to_arkade":
        return {
          step1Label: "User Funded",
          step1TxId: swapData.btc_fund_txid,
          step1IsEvm: false,
          step2LabelActive: "Server Funding",
          step2LabelComplete: "Server Funded",
          step2TxId: swapData.arkade_fund_txid,
          step2IsEvm: false,
          step3Label: "Client Redeeming",
          step3TxId: swapData.arkade_claim_txid,
          step3IsEvm: false,
          step4Label: "Server Redeemed",
          step4TxId: swapData.btc_claim_txid,
          step4IsEvm: false,
        };
      case "bitcoin_to_evm":
        return {
          step1Label: "User Funded",
          step1TxId: swapData.btc_fund_txid,
          step1IsEvm: false,
          step2LabelActive: "Server Funding",
          step2LabelComplete: "Server Funded",
          step2TxId: swapData.evm_fund_txid,
          step2IsEvm: true,
          step3Label: "Client Redeeming",
          step3TxId: swapData.evm_claim_txid,
          step3IsEvm: true,
          step4Label: "Server Redeemed",
          step4TxId: swapData.btc_claim_txid,
          step4IsEvm: false,
        };
      case "arkade_to_evm":
        return {
          step1Label: "User Funded",
          step1TxId: swapData.btc_fund_txid,
          step1IsEvm: false,
          step2LabelActive: "Server Funding",
          step2LabelComplete: "Server Funded",
          step2TxId: swapData.evm_fund_txid,
          step2IsEvm: true,
          step3Label: "Client Redeeming",
          step3TxId: swapData.evm_claim_txid,
          step3IsEvm: true,
          step4Label: "Server Redeemed",
          step4TxId: swapData.btc_claim_txid,
          step4IsEvm: false,
        };
      case "evm_to_arkade":
        return {
          step1Label: "User Funded",
          step1TxId: swapData.evm_fund_txid,
          step1IsEvm: true,
          step2LabelActive: "Server Funding",
          step2LabelComplete: "Server Funded",
          step2TxId: swapData.btc_fund_txid,
          step2IsEvm: false,
          step3Label: "Client Redeeming",
          step3TxId: swapData.btc_claim_txid,
          step3IsEvm: false,
          step4Label: "Server Redeemed",
          step4TxId: swapData.evm_claim_txid,
          step4IsEvm: true,
        };
      case "evm_to_bitcoin":
        return {
          step1Label: "User Funded",
          step1TxId: swapData.evm_fund_txid,
          step1IsEvm: true,
          step2LabelActive: "Server Funding",
          step2LabelComplete: "Server Funded",
          step2TxId: swapData.btc_fund_txid,
          step2IsEvm: false,
          step3Label: "Client Redeeming",
          step3TxId: swapData.btc_claim_txid,
          step3IsEvm: false,
          step4Label: "Server Redeemed",
          step4TxId: swapData.evm_claim_txid,
          step4IsEvm: true,
        };
      case "lightning_to_evm":
        return {
          step1Label: "User Funded",
          step1TxId: swapData.btc_claim_txid,
          step1IsEvm: false,
          step2LabelActive: "Server Funding",
          step2LabelComplete: "Server Funded",
          step2TxId: swapData.evm_fund_txid,
          step2IsEvm: true,
          step3Label: "Client Redeeming",
          step3TxId: swapData.evm_claim_txid,
          step3IsEvm: true,
          step4Label: "Server Redeemed",
          step4TxId: null,
          step4IsEvm: false,
        };
      case "evm_to_lightning":
        return {
          step1Label: "User Funded",
          step1TxId: swapData.evm_fund_txid,
          step1IsEvm: true,
          step2LabelActive: "Server Funding",
          step2LabelComplete: "Server Funded",
          step2TxId: swapData.evm_claim_txid,
          step2IsEvm: true,
          step3Label: "Lightning Payment",
          step3TxId: swapData.lightning_paid ? "paid" : null,
          step3IsEvm: false,
          step4Label: "Complete",
          step4TxId: swapData.lightning_paid ? "paid" : null,
          step4IsEvm: false,
        };
    }
  };

  const config = getConfig();

  // Check if client funding is still being confirmed (seen but not confirmed)
  const isClientFundingSeen = swapData.status === "clientfundingseen";

  // Determine which step is currently active (the first incomplete step)
  const getCurrentStep = () => {
    if (isClientFundingSeen) return 1; // Client funding seen, awaiting confirmation
    if (!config.step2TxId) return 2; // Server funding
    if (!config.step3TxId) return 3; // Client redeeming
    if (!config.step4TxId) return 4; // Server redeeming
    return 5; // All complete
  };

  const currentStep = getCurrentStep();

  const isBtcToEvm = isBtcToEvmDirection(swapData.direction);
  const isEvmToBtc = isEvmToBtcDirection(swapData.direction);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
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
            Receiving {swapData.target_token.symbol}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono text-muted-foreground">
            {swapId.slice(0, 8)}…
          </code>
          <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 p-6">
        <div className="space-y-4">
          {/* Step 1: User Funded */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                isClientFundingSeen ? "bg-muted" : "bg-primary"
              }`}
            >
              {isClientFundingSeen ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Check className="h-4 w-4 text-primary-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">
                {isClientFundingSeen
                  ? "User Funding Detected"
                  : config.step1Label}
              </p>
              {config.step1TxId && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(config.step1TxId)}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyTxId(config.step1TxId || "")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === config.step1TxId ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  {config.step1IsEvm && (
                    <a
                      href={`${getBlockexplorerTxLink(swapData.source_token.chain, config.step1TxId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
              {isClientFundingSeen && (
                <p className="text-xs text-muted-foreground">
                  Transaction detected, awaiting confirmation...
                </p>
              )}
            </div>
          </div>

          {/* Step 2: Server Funding/Funded */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                config.step2TxId ? "bg-primary" : "bg-muted"
              }`}
            >
              {config.step2TxId ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : currentStep === 2 ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">
                {config.step2TxId
                  ? config.step2LabelComplete
                  : config.step2LabelActive}
              </p>
              {config.step2TxId && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(config.step2TxId)}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyTxId(config.step2TxId || "")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === config.step2TxId ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  {config.step2IsEvm && (
                    <a
                      href={`${getBlockexplorerTxLink(swapData.target_token.chain, config.step2TxId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Client Redeeming */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                config.step3TxId ? "bg-primary" : "bg-muted"
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
                  {config.step3IsEvm && (
                    <a
                      href={`${getBlockexplorerTxLink(swapData.target_token.chain, config.step3TxId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
              {/* Show claiming status inline when server is funded */}
              {swapData.status === "serverfunded" && (
                <div className="from-primary/5 to-card mt-2 space-y-2 rounded-lg border bg-gradient-to-t p-4">
                  <p className="text-sm font-medium">
                    {isClaiming
                      ? isEvmToBtc
                        ? "Redeeming your sats..."
                        : "Claiming your tokens..."
                      : isEvmToBtc
                        ? "VHTLC Funded"
                        : "HTLC Funded"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {isClaiming
                      ? isEvmToBtc
                        ? "Claiming the Bitcoin VHTLC and publishing the transaction..."
                        : isEthereumToken(swapData.target_token.chain)
                          ? "Claiming tokens via your Ethereum wallet (you pay gas)..."
                          : "Submitting claim request via Gelato Relay..."
                      : isEvmToBtc
                        ? "The VHTLC has been funded. Preparing to claim your sats..."
                        : "The HTLC has been funded. Preparing to claim your tokens..."}
                  </p>
                  {retryCount > 0 && retryCount < maxRetries && (
                    <p className="text-muted-foreground text-xs">
                      Retry attempt {retryCount}/{maxRetries}...
                    </p>
                  )}
                  {isBtcToEvm &&
                    !isClaiming &&
                    !claimError &&
                    isEthereumToken(swapData.target_token.chain) &&
                    !address && (
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs">
                          Connect your Ethereum wallet to claim your tokens.
                        </p>
                        <Button
                          onClick={() => setOpen(true)}
                          size="sm"
                          className="w-full"
                        >
                          Connect Wallet
                        </Button>
                      </div>
                    )}
                  {isBtcToEvm && !isClaiming && !claimError && address && (
                    <p className="text-muted-foreground text-xs">
                      {isEthereumToken(swapData.target_token.chain)
                        ? "You will need ETH in your wallet to pay for gas fees to claim your tokens."
                        : "Gas fees fully sponsored via Gelato Relay - no fees for you!"}
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

          {/* Step 4: Server Redeemed */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                config.step4TxId ? "bg-primary" : "bg-muted"
              }`}
            >
              {config.step4TxId ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : currentStep === 4 ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">{config.step4Label}</p>
              {config.step4TxId && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(config.step4TxId)}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyTxId(config.step4TxId || "")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === config.step4TxId ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  {config.step4IsEvm && (
                    <a
                      href={`${getBlockexplorerTxLink(swapData.source_token.chain, config.step4TxId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
