import { Loader } from "lucide-react";
import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Button } from "#/components/ui/button";
import { PolygonToBtcSwapResponse } from "../../api";
import { getTokenSymbol } from "../../api";

// ERC20 ABI - approve and allowance functions
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface PolygonDepositStepProps {
  swapData: PolygonToBtcSwapResponse;
  swapId: string;
}

export function PolygonDepositStep({
  swapData,
  swapId,
}: PolygonDepositStepProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState("");

  const tokenSymbol = getTokenSymbol(swapData.source_token);
  const receiveAmount = swapData?.sats_receive
    ? (swapData.sats_receive / 100_000_000).toFixed(8)
    : 0;

  const handleSign = async () => {
    if (!walletClient || !address || !publicClient) {
      setError("Please connect your wallet");
      return;
    }

    setIsSigning(true);
    setError("");

    try {
      const htlcAddress = swapData.htlc_address_polygon as `0x${string}`;
      const tokenAddress = swapData.source_token_address as `0x${string}`;

      // Parse the amount needed for this swap
      // Convert USD amount to token amount with 6 decimals (USDC/USDT use 6 decimals)
      const decimals = 6;
      const amountNeeded = BigInt(
        Math.floor(swapData.usd_amount * Math.pow(10, decimals)),
      );

      console.log("Checking current allowance...");
      console.log("Amount needed:", amountNeeded.toString());

      // Check current allowance
      const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, htlcAddress],
      });

      console.log("Current allowance:", currentAllowance.toString());

      // Only approve if allowance is insufficient
      if (currentAllowance < amountNeeded) {
        console.log(
          "Step 1: Allowance insufficient, approving max amount (user pays gas)",
        );

        // Approve max uint256 to avoid future approvals
        const maxUint256 = BigInt(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        );

        // Execute approve transaction for max amount (user pays gas)
        const approveTxHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [htlcAddress, maxUint256],
          account: address,
        });

        console.log("Approve transaction hash:", approveTxHash);
        console.log("Waiting for approval transaction to be mined...");

        // Wait for the approved transaction to be confirmed
        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveTxHash,
        });

        console.log("Approve transaction confirmed:", approveReceipt.status);
        console.log("Approve tx:", approveTxHash);

        if (approveReceipt.status !== "success") {
          throw new Error("Approve transaction failed");
        }
      } else {
        console.log(
          "Step 1: Allowance sufficient, skipping approval transaction",
        );
      }

      console.log("Step 2: Executing createSwap transaction (user pays gas)");

      // Parse create_swap_tx calldata from swap data
      const createSwapCalldata = swapData.create_swap_tx as `0x${string}`;

      // Send createSwap transaction directly (user pays gas)
      const createSwapTxHash = await walletClient.sendTransaction({
        to: htlcAddress,
        data: createSwapCalldata,
        account: address,
      });

      console.log("CreateSwap transaction hash:", createSwapTxHash);
      console.log("Waiting for createSwap transaction to be mined...");

      // Wait for the createSwap transaction to be confirmed
      const createSwapReceipt = await publicClient.waitForTransactionReceipt({
        hash: createSwapTxHash,
      });

      console.log(
        "CreateSwap transaction confirmed:",
        createSwapReceipt.status,
      );

      if (createSwapReceipt.status !== "success") {
        throw new Error(
          `CreateSwap transaction failed: ${createSwapReceipt.status}`,
        );
      }

      console.log("Both transactions completed successfully!");
      console.log("CreateSwap tx:", createSwapTxHash);

      // The wizard will automatically move to the next step via polling
    } catch (err) {
      console.error("Transaction error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to execute transaction",
      );
    } finally {
      setIsSigning(false);
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
        <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
      </div>

      {/* Content */}
      <div className="space-y-6 p-6">
        {/* Amount Reminder */}
        <div className="bg-muted/50 space-y-2 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You Send</span>
            <span className="font-medium">
              ${swapData.usd_amount.toFixed(2)} {tokenSymbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            {swapData?.target_token === "btc_lightning" && (
              <span className="text-muted-foreground">We will send</span>
            )}
            {swapData?.target_token === "btc_arkade" && (
              <span className="text-muted-foreground">You receive</span>
            )}
            <span className="font-medium">~{receiveAmount} BTC</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground"></span>
            <span className="text-muted-foreground">
              (~{swapData.sats_receive} sats)
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20">
            {error}
          </div>
        )}

        {/* Wallet Connection Warning */}
        {!address && (
          <div className="rounded-lg border border-orange-500 bg-orange-50 p-3 text-sm text-orange-600 dark:bg-orange-950/20">
            Please connect your wallet to continue
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {/* Fund Swap button - always first */}
          <Button
            onClick={handleSign}
            disabled={isSigning || !address}
            className="h-12 w-full text-base font-semibold"
          >
            {isSigning ? (
              <>
                <Loader className="animate-spin h-4 w-4 mr-2" />
                Processing Transactions...
              </>
            ) : (
              "Fund Swap"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
