import {
  claimVhtlc,
  getAmountsForSwap,
  initBrowserWallet,
} from "@frontend/browser-wallet";
import { Check, Circle, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { Button } from "#/components/ui/button";
import {
  api,
  type BtcToEvmSwapResponse,
  type GetSwapResponse,
} from "../../api";
import {
  getBlockexplorerTxLink,
  getViemChain,
  isEthereumToken,
  isPolygonToken,
} from "../../utils/tokenUtils";

const ARK_SERVER_URL =
  import.meta.env.VITE_ARKADE_URL || "https://arkade.computer";

// ReverseAtomicSwapHTLC ABI - claimSwap function
const HTLC_ABI = [
  {
    type: "function",
    name: "claimSwap",
    inputs: [
      { name: "swapId", type: "bytes32", internalType: "bytes32" },
      { name: "secret", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Convert a UUID string to a bytes32 HTLC swap ID
 *
 * The HTLC swap ID is derived from the database swap UUID by:
 * 1. Taking the 16 bytes of the UUID (removing hyphens)
 * 2. Padding with zeros to make 32 bytes
 *
 * This matches the backend's uuid_to_htlc_swap_id function.
 */
function uuidToHtlcSwapId(uuid: string): `0x${string}` {
  // Remove hyphens from UUID
  const uuidHex = uuid.replace(/-/g, "");

  // Pad with zeros to make 32 bytes (64 hex chars)
  const paddedHex = uuidHex.padEnd(64, "0");

  return `0x${paddedHex}`;
}

interface ConfirmingDepositStepProps {
  swapData: GetSwapResponse;
  swapDirection: "btc-to-evm" | "evm-to-btc";
  swapId: string;
}

export function SwapProcessingStep({
  swapData,
  swapDirection,
  swapId,
}: ConfirmingDepositStepProps) {
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const hasClaimedRef = useRef(false);
  const [wasmInitialized, setWasmInitialized] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 10;

  const chain = getViemChain(swapData.target_token);

  // Wallet client hooks for Ethereum claiming
  const { data: walletClient } = useWalletClient({ chainId: chain?.id });
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { switchChainAsync } = useSwitchChain();

  // Load secret from localStorage
  useEffect(() => {
    const swapData_local = localStorage.getItem(swapData.id);
    console.log("Loading secret from localStorage for swapId:", swapData.id);
    console.log("LocalStorage data:", swapData_local);

    if (swapData_local) {
      try {
        const parsed = JSON.parse(swapData_local);
        console.log("Parsed swap data:", parsed);
        setSecret(parsed.secret || null);
        console.log("Secret set to:", parsed.secret || null);
      } catch (error) {
        console.error("Failed to parse swap data from localStorage:", error);
      }
    } else {
      console.warn(
        "No swap data found in localStorage for swapId:",
        swapData.id,
      );
    }
  }, [swapData.id]);

  // Initialize WASM module on mount
  useEffect(() => {
    initBrowserWallet()
      .then(() => {
        console.log("Browser wallet WASM initialized");
        setWasmInitialized(true);
      })
      .catch((error) => {
        console.error("Failed to initialize browser wallet:", error);
      });
  }, []);

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

  // Auto-claim for btc-to-evm when server is funded
  useEffect(() => {
    const autoClaimBtcToPolygonSwaps = async () => {
      if (swapDirection !== "btc-to-evm") return;
      if (swapData.status !== "serverfunded") return;
      if (!secret) return;

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

        const cleanSecret = secret.startsWith("0x") ? secret.slice(2) : secret;

        console.log("Auto-claiming with parameters:", {
          swapId: swapData.id,
          secret: cleanSecret,
          retryCount,
        });

        // Mark that we've attempted to claim
        localStorage.setItem(claimKey, Date.now().toString());

        if (isPolygonToken(swapData.target_token)) {
          await api.claimGelato(swapData.id, cleanSecret);
        } else if (isEthereumToken(swapData.target_token)) {
          // Ethereum: claim using user's wallet
          if (!walletClient || !publicClient || !switchChainAsync) {
            throw new Error(
              "Wallet not connected. Please connect your Ethereum wallet to claim.",
            );
          }

          if (!chain) {
            throw new Error(
              `Unsupported token for chain switching: ${swapData.target_token}`,
            );
          }

          // Switch to the correct chain if needed
          console.log("Switching to chain:", chain.name);
          await switchChainAsync({ chainId: chain.id });

          const htlcAddress = swapData.htlc_address_evm as `0x${string}`;
          // Convert UUID to bytes32 by removing hyphens and padding with zeros
          const swapIdBytes32 = uuidToHtlcSwapId(swapData.id);
          const secretBytes32 = `0x${cleanSecret}` as `0x${string}`;

          console.log("Claiming Ethereum HTLC with wallet...", {
            htlcAddress,
            swapIdBytes32,
            secretBytes32,
          });

          // Call claimSwap on the HTLC contract
          const claimTxHash = await walletClient.writeContract({
            address: htlcAddress,
            abi: HTLC_ABI,
            functionName: "claimSwap",
            args: [swapIdBytes32, secretBytes32],
            account: walletClient.account,
            chain,
          });

          console.log("Claim transaction hash:", claimTxHash);
          console.log("Waiting for claim transaction to be mined...");

          // Wait for the claim transaction to be confirmed
          const claimReceipt = await publicClient.waitForTransactionReceipt({
            hash: claimTxHash,
          });

          console.log("Claim transaction confirmed:", claimReceipt.status);

          if (claimReceipt.status !== "success") {
            throw new Error("Claim transaction failed");
          }
        }

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

        // Only remove localStorage flag if we haven't exhausted retries
        if (newRetryCount < maxRetries) {
          localStorage.removeItem(claimKey);
          hasClaimedRef.current = false;
        }
      } finally {
        setIsClaiming(false);
      }
    };

    autoClaimBtcToPolygonSwaps();
  }, [
    swapData,
    swapDirection,
    secret,
    isClaiming,
    retryCount,
    sleep,
    walletClient,
    publicClient,
    switchChainAsync,
    chain,
  ]);

  // Auto-claim for evm-to-btc when server is funded
  useEffect(() => {
    const autoClaimPolygonToArkadeSwaps = async () => {
      const polygonToBtcSwapData = swapData as BtcToEvmSwapResponse;
      if (swapDirection !== "evm-to-btc") return;
      if (polygonToBtcSwapData.target_token === "btc_lightning") {
        // this will be claimed by the lightning client
        return;
      }
      if (polygonToBtcSwapData.status !== "serverfunded") return;
      if (!wasmInitialized) return;
      if (!polygonToBtcSwapData.user_address_arkade) {
        console.error("No user address for arkade provided");
        setClaimError("Missing Arkade address for claim");
        return;
      }

      const claimKey = `swap_${polygonToBtcSwapData.id}_claim_attempted`;
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

        const fetchedAmounts = await getAmountsForSwap(
          ARK_SERVER_URL,
          polygonToBtcSwapData.id,
        );
        console.log(`Fetched amounts for swap`, fetchedAmounts);

        console.log("Auto-claiming with parameters:", {
          swapId: polygonToBtcSwapData.id,
          retryCount,
        });

        // Mark that we've attempted to claim
        localStorage.setItem(claimKey, Date.now().toString());

        const txid = await claimVhtlc(
          ARK_SERVER_URL,
          polygonToBtcSwapData.id,
          polygonToBtcSwapData.user_address_arkade,
        );
        console.log(`Claim request sent successfully ${txid}`);
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

    autoClaimPolygonToArkadeSwaps();
  }, [swapData, swapDirection, wasmInitialized, isClaiming, retryCount, sleep]);

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
  const config =
    swapDirection === "btc-to-evm"
      ? {
          step1Label: "User Funded",
          step1TxId: swapData.bitcoin_htlc_fund_txid,
          step1IsPolygon: false,
          step2LabelActive: "Server Funding",
          step2LabelComplete: "Server Funded",
          step2TxId: swapData.evm_htlc_fund_txid,
          step2IsPolygon: true,
          step3Label: "Client Redeeming",
          step3TxId: swapData.evm_htlc_claim_txid,
          step3IsPolygon: true,
          step4Label: "Server Redeemed",
          step4TxId: swapData.bitcoin_htlc_claim_txid,
          step4IsPolygon: false,
        }
      : {
          step1Label: "User Funded",
          step1TxId: swapData.evm_htlc_fund_txid,
          step1IsPolygon: true,
          step2LabelActive: "Server Funding",
          step2LabelComplete: "Server Funded",
          step2TxId: swapData.bitcoin_htlc_fund_txid,
          step2IsPolygon: false,
          step3Label: "Client Redeeming",
          step3TxId: swapData.bitcoin_htlc_claim_txid,
          step3IsPolygon: false,
          step4Label: "Server Redeemed",
          step4TxId: swapData.evm_htlc_claim_txid,
          step4IsPolygon: true,
        };

  // Determine which step is currently active (the first incomplete step)
  const getCurrentStep = () => {
    if (!config.step2TxId) return 2; // Server funding
    if (!config.step3TxId) return 3; // Client redeeming
    if (!config.step4TxId) return 4; // Server redeeming
    return 5; // All complete
  };

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
          {/* Step 1: User Funded */}
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
              <Check className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">{config.step1Label}</p>
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
                  {config.step1IsPolygon && (
                    <a
                      href={`${getBlockexplorerTxLink(swapData.source_token, config.step1TxId)}`}
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
                  {config.step2IsPolygon && (
                    <a
                      href={`${getBlockexplorerTxLink(swapData.target_token, config.step2TxId)}`}
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
                  {config.step3IsPolygon && (
                    <a
                      href={`${getBlockexplorerTxLink(swapData.target_token, config.step3TxId)}`}
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
                      ? swapDirection === "evm-to-btc"
                        ? "Redeeming your sats..."
                        : "Claiming your tokens..."
                      : swapDirection === "evm-to-btc"
                        ? "VHTLC Funded"
                        : "HTLC Funded"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {isClaiming
                      ? swapDirection === "evm-to-btc"
                        ? swapData.target_token === "btc_lightning"
                          ? "Claiming the Bitcoin VHTLC and publishing the transaction..."
                          : "Lightning invoice is pending..."
                        : isEthereumToken(swapData.target_token)
                          ? "Claiming tokens via your Ethereum wallet (you pay gas)..."
                          : "Submitting claim request via Gelato Relay..."
                      : swapDirection === "evm-to-btc"
                        ? "The VHTLC has been funded. Preparing to claim your sats..."
                        : "The HTLC has been funded. Preparing to claim your tokens..."}
                  </p>
                  {retryCount > 0 && retryCount < maxRetries && (
                    <p className="text-muted-foreground text-xs">
                      Retry attempt {retryCount}/{maxRetries}...
                    </p>
                  )}
                  {swapDirection === "btc-to-evm" &&
                    !isClaiming &&
                    !claimError && (
                      <p className="text-muted-foreground text-xs">
                        {isEthereumToken(swapData.target_token)
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
                  {config.step4IsPolygon && (
                    <a
                      href={`${getBlockexplorerTxLink(swapData.source_token, config.step4TxId)}`}
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
