import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { api, type GetSwapResponse, type TokenId } from "../api";
import { LoadingStep } from "../steps";
import { isDebugMode } from "../utils/debugMode";
import { CardContent } from "#/components/ui/card";

// Get display symbol for a token
function getTokenSymbol(tokenId: TokenId): string {
  switch (tokenId) {
    case "usdc_pol":
      return "USDC";
    case "usdt_pol":
      return "USDT";
    default:
      return "USDC";
  }
}

export function SwapProcessingPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();
  const [swap, setSwap] = useState<GetSwapResponse | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const hasClaimedRef = useRef(false);

  // Load secret from localStorage
  useEffect(() => {
    if (!swapId) return;

    const swapData = localStorage.getItem(swapId);
    console.log("Loading secret from localStorage for swapId:", swapId);
    console.log("LocalStorage data:", swapData);

    if (swapData) {
      try {
        const parsed = JSON.parse(swapData);
        console.log("Parsed swap data:", parsed);
        setSecret(parsed.secret || null);
        console.log("Secret set to:", parsed.secret || null);
      } catch (error) {
        console.error("Failed to parse swap data from localStorage:", error);
      }
    } else {
      console.warn("No swap data found in localStorage for swapId:", swapId);
    }
  }, [swapId]);

  // Automatically claim when swap is serverfunded
  useEffect(() => {
    const autoClaim = async () => {
      if (!swap || !secret || !swapId) return;
      if (swap.status !== "serverfunded") return;

      // Check if we've already attempted to claim this swap (persists across refreshes)
      const claimKey = `swap_${swapId}_claim_attempted`;
      if (localStorage.getItem(claimKey)) {
        console.log("Claim already attempted for this swap, skipping");
        return;
      }

      if (hasClaimedRef.current || isClaiming) return;

      hasClaimedRef.current = true;
      setIsClaiming(true);
      setClaimError(null);

      try {
        const cleanSecret = secret.startsWith("0x") ? secret.slice(2) : secret;

        console.log("Auto-claiming with parameters:", {
          swapId,
          secret: cleanSecret,
        });

        // Mark that we've attempted to claim BEFORE making the API call
        localStorage.setItem(claimKey, Date.now().toString());

        await api.claimGelato(swapId, cleanSecret);

        console.log("Claim request sent successfully");
      } catch (error) {
        console.error("Failed to auto-claim:", error);
        const tokenSymbol = swap ? getTokenSymbol(swap.target_token) : "tokens";
        setClaimError(
          error instanceof Error
            ? error.message
            : `Failed to claim ${tokenSymbol}`,
        );
        // Remove the localStorage flag on error to allow retry
        localStorage.removeItem(claimKey);
        hasClaimedRef.current = false;
      } finally {
        setIsClaiming(false);
      }
    };

    autoClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swap?.status, secret, swapId]);

  // Poll swap status
  useEffect(() => {
    if (!swapId) {
      navigate("/", { replace: true });
      return;
    }

    // Skip polling in debug mode
    if (isDebugMode()) {
      return;
    }

    // Track when payment was received (funded status)
    const fundedTimestamp = Date.now();
    localStorage.setItem(
      `swap_${swapId}_funded_at`,
      fundedTimestamp.toString(),
    );

    const pollSwapStatus = async () => {
      try {
        const swapData = await api.getSwap(swapId);
        console.log("Polling swap status:", swapData);
        setSwap(swapData);

        // Transition to success page when complete
        if (swapData.status === "serverredeemed") {
          console.log("Swap complete! Transitioning to success...");
          navigate(`/swap/${swapId}/success`, { replace: true });
        }
      } catch (error) {
        console.error("Failed to poll swap status:", error);
        navigate("/", { replace: true });
      }
    };

    // Poll immediately
    pollSwapStatus();

    // Then poll every 5 seconds
    const interval = setInterval(pollSwapStatus, 5000);

    return () => clearInterval(interval);
  }, [swapId, navigate]);

  if (!swap) {
    return (
      <LoadingStep
        status="pending"
        swapId={swapId || undefined}
        tokenSymbol="USDC"
      />
    );
  }

  const tokenSymbol = getTokenSymbol(swap.target_token);

  console.log("Render check:", {
    status: swap.status,
    secret: secret,
    isClaiming: isClaiming,
  });

  // Show claiming status when HTLC is funded
  if (swap.status === "serverfunded" && secret) {
    return (
      <CardContent className="space-y-6 py-12">
        <LoadingStep
          status={swap.status}
          swapId={swap.id}
          tokenSymbol={tokenSymbol}
        />
        <div className="mx-auto max-w-md">
          <div className="from-primary/5 to-card space-y-4 rounded-lg border bg-gradient-to-t p-6">
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-semibold">
                {isClaiming
                  ? `Claiming Your ${tokenSymbol}...`
                  : "Claim Submitted"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {isClaiming
                  ? "Submitting claim request to the server..."
                  : "Your claim is being processed. This may take a few moments."}
              </p>
            </div>
            {claimError && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                {claimError}
              </div>
            )}
            <p className="text-muted-foreground text-center text-xs">
              Gas fees fully sponsored via Gelato Relay - no fees for you!
            </p>
          </div>
        </div>
      </CardContent>
    );
  }

  return (
    <LoadingStep
      status={swap.status}
      swapId={swap.id}
      tokenSymbol={tokenSymbol}
    />
  );
}
