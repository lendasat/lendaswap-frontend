import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { api, type PolygonToArkadeSwapResponse } from "../api";

// ERC20 ABI - only the approve function
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
] as const;

export function SwapSignPolygonPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [swap, setSwap] = useState<PolygonToArkadeSwapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState("");

  // Fetch swap data
  useEffect(() => {
    if (!swapId) return;

    const fetchSwap = async () => {
      try {
        const swapData = await api.getSwap(swapId);

        // Detect if this is a Polygon → Arkade swap by checking for create_swap_tx
        if (!("create_swap_tx" in swapData)) {
          setError("This is not a Polygon → Arkade swap");
          return;
        }

        console.log(JSON.stringify(swapData));

        setSwap(swapData as unknown as PolygonToArkadeSwapResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load swap");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSwap();
  }, [swapId]);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader className="animate-spin h-8 w-8 mx-auto" />
        <p className="mt-4">Loading swap...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={() => navigate("/")} className="mt-4">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!swap) {
    return <div className="p-8 text-center">Swap not found</div>;
  }

  const handleSign = async () => {
    if (!walletClient || !address || !publicClient) {
      setError("Please connect your wallet");
      return;
    }

    setIsSigning(true);
    setError("");

    try {
      const htlcAddress = swap.polygon_address as `0x${string}`;
      const tokenAddress = swap.source_token_address as `0x${string}`;

      // Parse amounts - assuming USD amount with 6 decimals for USDC/USDT
      const amountToApprove = BigInt(Math.floor(swap.usd_amount * 1_000_000));

      console.log("Step 1: Approving HTLC to spend tokens (user pays gas)");

      // Execute regular approve transaction (user pays gas)
      const approveTxHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [htlcAddress, amountToApprove],
        account: address,
      });

      console.log("Approve transaction hash:", approveTxHash);
      console.log("Waiting for approval transaction to be mined...");

      // Wait for the approve transaction to be confirmed
      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxHash,
      });

      console.log("Approve transaction confirmed:", approveReceipt.status);

      if (approveReceipt.status !== "success") {
        throw new Error("Approve transaction failed");
      }

      console.log("Step 2: Executing createSwap transaction (user pays gas)");

      // Parse create_swap_tx calldata from swap data
      const createSwapCalldata = swap.create_swap_tx as `0x${string}`;

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
      console.log("Approve tx:", approveTxHash);
      console.log("CreateSwap tx:", createSwapTxHash);

      // Navigate to status page
      navigate(`/swap/${swapId}/status`);
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
    <div className="p-8 max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Execute Swap on Polygon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">You're sending:</p>
            <p className="text-xl font-bold">
              ${swap.usd_amount.toFixed(2)} USD
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">You'll receive:</p>
            <p className="text-xl font-bold">
              {(swap.sats_receive / 100_000_000).toFixed(8)} BTC
            </p>
            <p className="text-xs text-gray-500">
              ({swap.sats_receive.toLocaleString()} sats)
            </p>
          </div>

          <div className="bg-blue-50 p-3 rounded text-sm dark:bg-blue-950">
            <p className="font-medium">Two Transactions Required</p>
            <p className="text-gray-600 dark:text-gray-400">
              You'll need to approve two transactions: (1) Approve the HTLC
              contract to spend your tokens, and (2) Create the swap. You'll pay
              gas for both.
            </p>
          </div>

          {!address && (
            <p className="text-red-500 text-sm">
              Please connect your wallet to continue
            </p>
          )}

          <Button
            onClick={handleSign}
            disabled={isSigning || !address}
            className="w-full"
          >
            {isSigning ? (
              <>
                <Loader className="animate-spin h-4 w-4 mr-2" />
                Processing Transactions...
              </>
            ) : (
              "Execute Swap"
            )}
          </Button>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
