import confetti from "canvas-confetti";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, type SwapResponse, type TokenId } from "../api";
import { SuccessStep } from "../steps";
import {
  isDebugMode,
  mockPolygonAddress,
  mockSwapData,
  mockTxId,
} from "../utils/debugMode";

// Get display symbol for a token
function getTokenSymbol(tokenId: TokenId): string {
  switch (tokenId) {
    case "usdc_pol":
      return "USDC";
    case "usdt_pol":
      return "USDT0";
    default:
      return "USDC";
  }
}

export function SwapSuccessPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();
  const [swapData, setSwapData] = useState<SwapResponse | null>(null);
  const [usdcAmount, setUsdcAmount] = useState("");
  const [receiveAddress, setReceiveAddress] = useState("");
  const [redeemTx, setRedeemTx] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenSymbol, setTokenSymbol] = useState("USDC");
  const [swapDurationSeconds, setSwapDurationSeconds] = useState<number | null>(
    null,
  );

  // Fetch swap data
  useEffect(() => {
    if (!swapId) {
      navigate("/", { replace: true });
      return;
    }

    // Use mock data in debug mode
    if (isDebugMode()) {
      setSwapData(mockSwapData);
      setUsdcAmount(mockSwapData.usd_amount.toFixed(2));
      setReceiveAddress(mockPolygonAddress);
      setRedeemTx(mockTxId);
      setSwapDurationSeconds(12); // Mock: 12 seconds
      setIsLoading(false);

      // Fire confetti in debug mode too! 🎉
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#F7931A"],
      });

      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#F7931A"],
        });
      }, 250);

      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#F7931A"],
        });
      }, 400);

      return;
    }

    const fetchSwapData = async () => {
      try {
        setIsLoading(true);
        const swap = await api.getSwap(swapId);

        setSwapData(swap);
        setUsdcAmount(swap.usd_amount.toFixed(2));
        // FIXME: this needs to be dynamic on wether it is is arkade or polygon swap
        switch (swap.target_token) {
          case "btc_lightning":
          case "btc_arkade":
            setReceiveAddress(swap.user_address_arkade);
            break;
          case "usdc_pol":
          case "usdt_pol":
            setReceiveAddress(swap.user_address_polygon);
            break;
        }
        setTokenSymbol(getTokenSymbol(swap.target_token));

        if (swap.polygon_htlc_claim_txid) {
          setRedeemTx(swap.polygon_htlc_claim_txid);
        }

        // Calculate swap duration
        const fundedAtStr = localStorage.getItem(`swap_${swapId}_funded_at`);
        if (fundedAtStr) {
          const fundedAt = parseInt(fundedAtStr);
          const completedAt = Date.now();
          const durationSeconds = Math.round((completedAt - fundedAt) / 1000);
          setSwapDurationSeconds(durationSeconds);
          // Clean up localStorage
          localStorage.removeItem(`swap_${swapId}_funded_at`);
        }

        // Redirect to correct step if not done
        if (swap.status === "pending") {
          navigate(`/swap/${swapId}/send`, { replace: true });
        } else if (
          swap.status === "clientfunded" ||
          swap.status === "serverfunded"
        ) {
          navigate(`/swap/${swapId}/processing`, { replace: true });
        } else if (swap.status === "serverredeemed") {
          // Fire confetti on successful swap! 🎉
          // Multiple bursts for extra celebration
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#F7931A"],
          });

          // Second burst after a short delay
          setTimeout(() => {
            confetti({
              particleCount: 50,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: ["#F7931A"],
            });
          }, 250);

          // Third burst from the other side
          setTimeout(() => {
            confetti({
              particleCount: 50,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: ["#F7931A"],
            });
          }, 400);
        }
      } catch (error) {
        console.error("Failed to fetch swap data:", error);
        navigate("/", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSwapData();
  }, [swapId, navigate]);

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  if (isLoading || !swapData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="border-muted border-t-foreground h-16 w-16 animate-spin rounded-full border-4" />
      </div>
    );
  }

  return (
    <SuccessStep
      swapData={swapData}
      usdcAmount={usdcAmount}
      receiveAddress={receiveAddress}
      swapTxId={redeemTx}
      copiedAddress={copiedAddress}
      handleCopyAddress={handleCopyAddress}
      swapDurationSeconds={swapDurationSeconds}
      tokenSymbol={tokenSymbol}
    />
  );
}
