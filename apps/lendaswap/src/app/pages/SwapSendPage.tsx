import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { api, type SwapResponse } from "../api";
import { SendBitcoinStep } from "../steps";
import { isDebugMode, mockSwapData } from "../utils/debugMode";

export function SwapSendPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();
  const [swapData, setSwapData] = useState<SwapResponse | null>(null);
  const [usdcAmount, setUsdcAmount] = useState("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

        // Reconstruct SwapResponse from GetSwapResponse
        const swapResponse: SwapResponse = {
          id: swap.id,
          ln_invoice: swap.ln_invoice,
          arkade_address: swap.arkade_address,
          sats_required: swap.sats_required,
          usd_amount: swap.usd_amount,
          usd_per_sat: swap.usd_per_sat,
          hash_lock: swap.hash_lock,
        };
        setSwapData(swapResponse);
        setUsdcAmount(swap.usd_amount.toFixed(2));

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
  const arkadeAddress = swapData.arkade_address || null;
  const btcRequired = swapData.sats_required / 100_000_000;
  const unifiedAddress = `bitcoin:?arkade=${arkadeAddress}&lightning=${lightningAddress}&amount=${btcRequired}`;

  return (
    <SendBitcoinStep
      arkadeAddress={arkadeAddress}
      lightningAddress={lightningAddress}
      unifiedAddress={unifiedAddress}
      swapData={swapData}
      usdcAmount={usdcAmount}
      copiedAddress={copiedAddress}
      handleCopyAddress={handleCopyAddress}
    />
  );
}
