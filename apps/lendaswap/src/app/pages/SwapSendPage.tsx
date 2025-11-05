import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, type SwapResponse, type TokenId } from "../api";
import { SendBitcoinStep } from "../steps";
import { isDebugMode, mockSwapData } from "../utils/debugMode";

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

export function SwapSendPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();
  const [swapData, setSwapData] = useState<SwapResponse | null>(null);
  const [usdcAmount, setUsdcAmount] = useState("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenSymbol, setTokenSymbol] = useState("USDC");

  // Fetch swap data initially
  useEffect(() => {
    if (!swapId) {
      navigate("/", { replace: true });
      return;
    }

    // Use mock data in debug mode
    if (isDebugMode()) {
      setSwapData(mockSwapData);
      setUsdcAmount(mockSwapData.usd_amount.toFixed(2));
      setIsLoading(false);
      return;
    }

    const fetchSwapData = async () => {
      try {
        setIsLoading(true);
        const swap = await api.getSwap(swapId);

        setSwapData(swap);
        setUsdcAmount(swap.usd_amount.toFixed(2));
        setTokenSymbol(getTokenSymbol(swap.target_token));

        // Redirect to correct step based on status
        if (
          swap.status === "serverredeemed" ||
          swap.status === "clientredeemed"
        ) {
          console.log("Swap complete! Transitioning to success...");
          navigate(`/swap/${swapId}/success`, { replace: true });
        } else if (
          swap.status === "clientfunded" ||
          swap.status === "serverfunded"
        ) {
          console.log("Payment received! Transitioning to processing...");
          navigate(`/swap/${swapId}/processing`, { replace: true });
        }
        // TODO: handle refund scenario
      } catch (error) {
        console.error("Failed to fetch swap data:", error);
        navigate("/", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSwapData();
  }, [swapId, navigate]);

  // Poll swap status to detect when payment is received
  useEffect(() => {
    if (!swapId || isLoading) {
      return;
    }

    const pollSwapStatus = async () => {
      try {
        const swap = await api.getSwap(swapId);
        console.log("Polling swap status on send page:", swap);

        // Transition based on backend status
        if (
          swap.status === "serverredeemed" ||
          swap.status === "clientredeemed"
        ) {
          console.log("Swap complete! Transitioning to success...");
          navigate(`/swap/${swapId}/success`, { replace: true });
        } else if (
          swap.status === "clientfunded" ||
          swap.status === "serverfunded"
        ) {
          console.log("Payment received! Transitioning to processing...");
          navigate(`/swap/${swapId}/processing`, { replace: true });
        }
        // TODO: handle refund scenario
      } catch (error) {
        console.error("Failed to poll swap status:", error);
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(pollSwapStatus, 5000);

    return () => clearInterval(interval);
  }, [swapId, navigate, isLoading]);

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

  const lightningAddress = swapData.ln_invoice || null;
  const arkadeAddress = swapData.htlc_address_arkade || null;
  const btcRequired = swapData.sats_required / 100_000_000;
  const unifiedAddress = `bitcoin:?arkade=${arkadeAddress}&lightning=${lightningAddress}&amount=${btcRequired}`;

  return (
    <SendBitcoinStep
      arkadeAddress={arkadeAddress}
      lightningAddress={lightningAddress}
      unifiedAddress={unifiedAddress}
      swapData={swapData}
      usdcAmount={usdcAmount}
      tokenSymbol={tokenSymbol}
    />
  );
}
