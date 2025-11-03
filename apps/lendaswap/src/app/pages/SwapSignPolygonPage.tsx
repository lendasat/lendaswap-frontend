import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useWalletClient, useAccount } from "wagmi";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { api, type PolygonToArkadeSwapResponse } from "../api";
import { Loader } from "lucide-react";

export function SwapSignPolygonPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

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

  const handleSign = async () => {
    if (!swap || !walletClient || !address) {
      setError("Wallet not connected");
      return;
    }

    if (!swapId) {
      setError("No swap ID");
      return;
    }

    try {
      setIsSigning(true);
      setError("");

      const chainId = 137; // Polygon mainnet
      const userNonce = BigInt(swap.gelato_user_nonce);
      const userDeadline = BigInt(swap.gelato_user_deadline);

      let approveSignature: string | null = null;

      // Sign approve transaction if needed
      if (swap.approve_tx) {
        const approveTypedData = {
          domain: {
            name: "GelatoRelay1BalanceERC2771",
            version: "1",
            chainId,
            verifyingContract: swap.gelato_forwarder_address as `0x${string}`,
          },
          types: {
            SponsoredCallERC2771: [
              { name: "chainId", type: "uint256" },
              { name: "target", type: "address" },
              { name: "data", type: "bytes" },
              { name: "user", type: "address" },
              { name: "userNonce", type: "uint256" },
              { name: "userDeadline", type: "uint256" },
            ],
          },
          primaryType: "SponsoredCallERC2771" as const,
          message: {
            chainId: BigInt(chainId),
            target: swap.source_token_address as `0x${string}`, // Use ERC20 token address for approve
            data: swap.approve_tx as `0x${string}`,
            user: address,
            userNonce,
            userDeadline,
          },
        };

        approveSignature = await walletClient.signTypedData(approveTypedData);
      }

      // Sign createSwap transaction
      const createSwapNonce = approveSignature
        ? userNonce + BigInt(1)
        : userNonce;

      const createSwapTypedData = {
        domain: {
          name: "GelatoRelay1BalanceERC2771",
          version: "1",
          chainId,
          verifyingContract: swap.gelato_forwarder_address as `0x${string}`,
        },
        types: {
          SponsoredCallERC2771: [
            { name: "chainId", type: "uint256" },
            { name: "target", type: "address" },
            { name: "data", type: "bytes" },
            { name: "user", type: "address" },
            { name: "userNonce", type: "uint256" },
            { name: "userDeadline", type: "uint256" },
          ],
        },
        primaryType: "SponsoredCallERC2771" as const,
        message: {
          chainId: BigInt(chainId),
          target: swap.polygon_address as `0x${string}`,
          data: swap.create_swap_tx as `0x${string}`,
          user: address,
          userNonce: createSwapNonce,
          userDeadline,
        },
      };

      const createSwapSignature =
        await walletClient.signTypedData(createSwapTypedData);

      // Submit signatures to backend
      await api.submitToGelato(swapId, {
        approve_signature: approveSignature,
        create_swap_signature: createSwapSignature,
        user_nonce: swap.gelato_user_nonce,
        user_deadline: swap.gelato_user_deadline,
      });

      // Navigate to processing page
      navigate(`/swap/${swapId}/processing`);
    } catch (err) {
      console.error("Failed to sign transaction:", err);

      // Handle user rejection
      if (err instanceof Error && err.message.includes("User rejected")) {
        setError("Transaction signature was rejected");
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to sign transaction",
        );
      }
    } finally {
      setIsSigning(false);
    }
  };

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

  return (
    <div className="p-8 max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Sign Polygon Transaction</CardTitle>
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
            <p className="font-medium">Gasless Transaction</p>
            <p className="text-gray-600 dark:text-gray-400">
              This transaction will be executed by Gelato Relay. You only need
              to sign, no gas fees required.
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
                Signing...
              </>
            ) : (
              "Sign Transaction"
            )}
          </Button>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
