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
import {
  type EvmToBtcSwapResponse,
  getTokenDisplayName,
  getTokenSymbol,
} from "../../api";
import { getTokenIcon, getViemChain } from "../../utils/tokenUtils";

// Helper function to convert UUID to bytes32
// Example: "16446b7d-f430-4d95-b936-761e725fe637" -> "0x16446B7DF4304D95B936761E725FE63700000000000000000000000000000000"
function uuidToBytes32(uuid: string): `0x${string}` {
  // Remove dashes and convert to uppercase
  const hex = uuid.replace(/-/g, "").toUpperCase();
  // Pad with zeros to make it 64 characters (32 bytes)
  const padded = hex.padEnd(64, "0");
  return `0x${padded}`;
}

// HTLC ABI - getSwap and refundSwap functions
const HTLC_ABI = [
  {
    inputs: [{ name: "swapId", type: "bytes32" }],
    name: "getSwap",
    outputs: [
      {
        components: [
          { name: "sender", type: "address" },
          { name: "recipient", type: "address" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOut", type: "uint256" },
          { name: "hashLock", type: "bytes32" },
          { name: "timelock", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "poolFee", type: "uint24" },
          { name: "minAmountOut", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "swapId", type: "bytes32" }],
    name: "refundSwap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Swap state enum (matches contract)
enum SwapState {
  INVALID = 0,
  OPEN = 1,
  CLAIMED = 2,
  REFUNDED = 3,
}

const SWAP_STATE_LABELS: Record<SwapState, string> = {
  [SwapState.INVALID]: "Invalid",
  [SwapState.OPEN]: "Open",
  [SwapState.CLAIMED]: "Claimed",
  [SwapState.REFUNDED]: "Refunded",
};

interface ContractSwap {
  sender: string;
  recipient: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  hashLock: string;
  timelock: bigint;
  state: SwapState;
  poolFee: number;
  minAmountOut: bigint;
}

interface PolygonToBtcRefundStepProps {
  swapData: EvmToBtcSwapResponse;
  swapId: string;
}

export function PolygonToBtcRefundStep({
  swapData,
  swapId,
}: PolygonToBtcRefundStepProps) {
  const posthog = usePostHog();
  const { address } = useAccount();

  const chain = getViemChain(swapData.source_token);

  const { data: walletClient } = useWalletClient({ chainId: chain?.id });
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { switchChainAsync } = useSwitchChain();

  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [contractSwap, setContractSwap] = useState<ContractSwap | null>(null);
  const [isLoadingSwap, setIsLoadingSwap] = useState(false);

  const tokenSymbol = getTokenSymbol(swapData.source_token);
  const refundLocktimeDate = new Date(swapData.evm_refund_locktime * 1000);

  // Countdown timer state
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLocktimePassed = now >= swapData.evm_refund_locktime;

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    if (isLocktimePassed) return null;

    const secondsLeft = swapData.evm_refund_locktime - now;
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
  }, [now, swapData.evm_refund_locktime, isLocktimePassed]);

  // Format token amount
  const refundAmount = `$${swapData.asset_amount.toString()} ${tokenSymbol}`;

  // Fetch swap data from contract
  useEffect(() => {
    if (!publicClient || !swapData.htlc_address_evm) return;

    const fetchSwapData = async () => {
      setIsLoadingSwap(true);
      try {
        const htlcAddress = swapData.htlc_address_evm as `0x${string}`;
        const swapIdBytes32 = uuidToBytes32(swapId);

        console.log("Fetching swap from contract:", {
          htlcAddress,
          swapId,
          swapIdBytes32,
        });

        const result = (await publicClient.readContract({
          address: htlcAddress,
          abi: HTLC_ABI,
          functionName: "getSwap",
          args: [swapIdBytes32],
        })) as ContractSwap;

        console.log("Contract swap data:", result);
        setContractSwap(result);
      } catch (error) {
        console.error("Failed to fetch swap from contract:", error);
        setRefundError(
          `Failed to fetch swap data: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsLoadingSwap(false);
      }
    };

    fetchSwapData();
  }, [publicClient, swapData.htlc_address_evm, swapId]);

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

    if (!contractSwap || contractSwap.state !== SwapState.OPEN) {
      setRefundError("Swap is not in an open state for refund");
      return;
    }

    setIsRefunding(true);
    setRefundError(null);
    setRefundSuccess(null);

    try {
      if (!chain) {
        throw new Error(
          `Unsupported token for chain switching: ${swapData.source_token}`,
        );
      }

      // Switch to the correct chain if needed
      console.log("Switching to chain:", chain.name);
      await switchChainAsync({ chainId: chain.id });

      const htlcAddress = swapData.htlc_address_evm as `0x${string}`;
      const swapIdBytes32 = uuidToBytes32(swapId);

      console.log("Executing refund transaction...");
      console.log("Calling refundSwap with:", {
        htlcAddress,
        swapId,
        swapIdBytes32,
      });

      // Call refundSwap function on the contract
      const refundTxHash = await walletClient.writeContract({
        address: htlcAddress,
        abi: HTLC_ABI,
        functionName: "refundSwap",
        args: [swapIdBytes32],
        account: address,
        chain,
      });

      console.log("Refund transaction hash:", refundTxHash);
      console.log("Waiting for refund transaction to be mined...");

      // Wait for the refund transaction to be confirmed
      const refundReceipt = await publicClient.waitForTransactionReceipt({
        hash: refundTxHash,
      });

      console.log("Refund transaction confirmed:", refundReceipt.status);

      if (refundReceipt.status !== "success") {
        throw new Error(`Refund transaction failed: ${refundReceipt.status}`);
      }

      console.log("Refund completed successfully!");
      console.log("Refund tx:", refundTxHash);

      setRefundSuccess(`Refund successful! Transaction hash: ${refundTxHash}`);

      // Track refund success
      posthog?.capture("swap_refunded", {
        swap_id: swapId,
        swap_direction: "evm-to-btc",
        refund_reason: "user_initiated",
        refund_txid: refundTxHash,
      });

      // Refresh swap state
      const updatedSwap = (await publicClient.readContract({
        address: htlcAddress,
        abi: HTLC_ABI,
        functionName: "getSwap",
        args: [swapIdBytes32],
      })) as ContractSwap;
      setContractSwap(updatedSwap);

      // The wizard will automatically update via polling
    } catch (err) {
      console.error("Refund error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to execute refund";
      setRefundError(errorMessage);

      posthog?.capture("swap_failed", {
        failure_type: "refund",
        swap_id: swapId,
        swap_direction: "evm-to-btc",
        error_message: errorMessage,
      });
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
            <p className="text-sm font-medium">HTLC Address</p>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {swapData.htlc_address_evm}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Refund Amount</p>
            <p className="text-xs text-muted-foreground">{refundAmount}</p>
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

          <div className="space-y-1">
            <p className="text-sm font-medium">Swap State</p>
            {isLoadingSwap ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <p className="text-xs text-muted-foreground">Loading...</p>
              </div>
            ) : contractSwap ? (
              <p className="text-xs text-muted-foreground">
                {SWAP_STATE_LABELS[contractSwap.state]}
                {contractSwap.state === SwapState.REFUNDED && (
                  <span className="ml-2 text-green-600">
                    (Already Refunded)
                  </span>
                )}
                {contractSwap.state === SwapState.CLAIMED && (
                  <span className="ml-2 text-blue-600">(Already Claimed)</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Unknown</p>
            )}
          </div>
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
        {isLocktimePassed &&
          contractSwap &&
          contractSwap.state === SwapState.OPEN && (
            <Button
              onClick={handleRefund}
              disabled={isRefunding || !address || isLoadingSwap}
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

        {/* Already refunded/claimed message */}
        {contractSwap && contractSwap.state === SwapState.REFUNDED && (
          <Alert>
            <AlertDescription>
              This swap has already been refunded. The USDC has been returned to
              the sender.
            </AlertDescription>
          </Alert>
        )}

        {contractSwap && contractSwap.state === SwapState.CLAIMED && (
          <Alert>
            <AlertDescription>
              This swap has already been claimed. The WBTC was sent to the
              recipient.
            </AlertDescription>
          </Alert>
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
