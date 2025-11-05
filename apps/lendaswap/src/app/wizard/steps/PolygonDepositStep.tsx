import {Loader} from "lucide-react";
import {useState} from "react";
import {useAccount, usePublicClient, useWalletClient} from "wagmi";
import {Button} from "#/components/ui/button";
import type {GetSwapResponse} from "../../api";
import {getTokenSymbol} from "../../api";

// ERC20 ABI - approve and allowance functions
const ERC20_ABI = [
  {
    inputs: [
      {name: "spender", type: "address"},
      {name: "amount", type: "uint256"},
    ],
    name: "approve",
    outputs: [{name: "", type: "bool"}],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {name: "owner", type: "address"},
      {name: "spender", type: "address"},
    ],
    name: "allowance",
    outputs: [{name: "", type: "uint256"}],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface PolygonDepositStepProps {
  swapData: GetSwapResponse;
}

export function PolygonDepositStep({swapData}: PolygonDepositStepProps) {
  const {address} = useAccount();
  const {data: walletClient} = useWalletClient();
  const publicClient = usePublicClient();

  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState("");

  const tokenSymbol = getTokenSymbol(swapData.source_token);
  const receiveAmount = (swapData.sats_required / 100_000_000).toFixed(8);

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
      const amountNeeded = BigInt(swapData.usd_amount);

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
        throw new Error("CreateSwap transaction failed");
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
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Fund Swap</h3>
        <p className="text-muted-foreground text-sm">
          Connect your wallet and approve the transactions to complete the swap
        </p>
      </div>

      <div className="bg-muted/50 space-y-4 rounded-lg p-4">
        <div>
          <p className="text-sm text-muted-foreground">You're sending:</p>
          <p className="text-xl font-bold">
            ${swapData.usd_amount.toFixed(2)} {tokenSymbol}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">You'll receive:</p>
          <p className="text-xl font-bold">~{receiveAmount} BTC</p>
          <p className="text-xs text-muted-foreground">
            (~{swapData.sats_required.toLocaleString()} sats)
          </p>
        </div>
      </div>

      {!address && (
        <p className="text-destructive text-sm">
          Please connect your wallet to continue
        </p>
      )}

      <Button
        onClick={handleSign}
        disabled={isSigning || !address}
        className="w-full h-12 text-base font-semibold"
      >
        {isSigning ? (
          <>
            <Loader className="animate-spin h-4 w-4 mr-2"/>
            Processing Transactions...
          </>
        ) : (
          "Fund Swap"
        )}
      </Button>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
