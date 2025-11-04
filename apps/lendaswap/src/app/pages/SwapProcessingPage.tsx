import {
  claimVhtlc,
  getAmountsForSwap,
  initBrowserWallet,
} from "@frontend/browser-wallet";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CardContent } from "#/components/ui/card";
import { api, type GetSwapResponse, type TokenId } from "../api";
import { LoadingStep } from "../steps";
import { isDebugMode } from "../utils/debugMode";
import { ARK_SERVER_URL } from "./ManageSwapPage";

// Swap direction types
type SwapDirection = "BTC_TO_POLYGON" | "POLYGON_TO_BTC";

// Get display symbol for a token
function getTokenSymbol(tokenId: TokenId): string {
  switch (tokenId) {
    case "usdc_pol":
      return "USDC";
    case "usdt_pol":
      return "USDT";
    case "btc_arkade":
      return "BTC";
    case "btc_lightning":
      return "BTC";
    default:
      return "USDC";
  }
}

// Determine swap direction based on source and target tokens
function getSwapDirection(
  sourceToken: TokenId,
  targetToken: TokenId,
): SwapDirection {
  // BTC → Polygon (USDC/USDT)
  if (
    (sourceToken === "btc_arkade" || sourceToken === "btc_lightning") &&
    (targetToken === "usdc_pol" || targetToken === "usdt_pol")
  ) {
    return "BTC_TO_POLYGON";
  }

  // Polygon (USDC/USDT) → BTC
  if (
    (sourceToken === "usdc_pol" || sourceToken === "usdt_pol") &&
    (targetToken === "btc_arkade" || targetToken === "btc_lightning")
  ) {
    return "POLYGON_TO_BTC";
  }

  throw Error(`Unsupported token pair ${sourceToken}-${targetToken}`);
}

export function SwapProcessingPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();
  const [swap, setSwap] = useState<GetSwapResponse | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const hasClaimedRef = useRef(false);
  const [swapDirection, setSwapDirection] = useState<SwapDirection | null>(
    null,
  );
  const [wasmInitialized, setWasmInitialized] = useState(false);
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

  // Automatically claim when swap is serverfunded (only for BTC → Polygon swaps)
  useEffect(() => {
    const autoClaimBtcToPolygonSwaps = async () => {
      if (!swap || !secret || !swapId || !swapDirection) return;
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

    if (swapDirection === "BTC_TO_POLYGON") {
      autoClaimBtcToPolygonSwaps();
      return;
    }

    const autoClaimBtcToArkadeSwaps = async () => {
      if (!swap || !secret || !swapId || !swapDirection) return;
      if (swap.status !== "serverfunded") return;
      if (!wasmInitialized) return;
      if (!swap.user_address_arkade) {
        console.error("No user address for arkade provided ");
        // todo, instead of failing, we could show a new input field
        return;
      }
      const claimKey = `swap_${swapId}_claim_attempted`;

      try {
        // FIXME: DO NOT HARDCODE URL, use the env file
        const fetchedAmounts = await getAmountsForSwap(
          "https://mutinynet.arkade.sh",
          swapId,
        );
        console.log(`Fetched amounts for swap`, fetchedAmounts);

        // Check if we've already attempted to claim this swap (persists across refreshes)

        if (localStorage.getItem(claimKey)) {
          console.log("Claim already attempted for this swap, skipping");
          return;
        }

        if (hasClaimedRef.current || isClaiming) return;

        hasClaimedRef.current = true;
        setIsClaiming(true);
        setClaimError(null);

        const cleanSecret = secret.startsWith("0x") ? secret.slice(2) : secret;

        console.log("Auto-claiming with parameters:", {
          swapId,
          secret: cleanSecret,
        });

        // Mark that we've attempted to claim BEFORE making the API call
        localStorage.setItem(claimKey, Date.now().toString());

        const txid = await claimVhtlc(
          ARK_SERVER_URL,
          swapId,
          swap.user_address_arkade,
        );
        console.log(`Claim request sent successfully ${txid}`);
      } catch (error) {
        console.error("Failed to auto-claim:", error);
        setClaimError(
          error instanceof Error
            ? error.message
            : `Failed to refund swap. Check the logs or try again later.`,
        );
        // Remove the localStorage flag on error to allow retry
        localStorage.removeItem(claimKey);
        hasClaimedRef.current = false;
      } finally {
        setIsClaiming(false);
      }
    };

    if (swapDirection === "POLYGON_TO_BTC") {
      autoClaimBtcToArkadeSwaps();
      return;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swap, secret, swapId, swapDirection, isClaiming, wasmInitialized]);

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

        // Determine swap direction from source and target tokens
        const direction = getSwapDirection(
          swapData.source_token,
          swapData.target_token,
        );
        setSwapDirection(direction);
        console.log("Swap direction:", direction);

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
  if (swap.status === "serverfunded" && secret && swapDirection) {
    // Polygon → BTC: Show waiting for BTC UI
    if (swapDirection === "POLYGON_TO_BTC") {
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
                  The VHTLC has been funded
                </h3>
                <p className="text-muted-foreground text-sm">
                  Readming your sats
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded dark:bg-yellow-950">
                <p className="font-medium text-sm">
                  FIXME: Client-side BTC Claiming
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Need to implement Arkade VHTLC claiming logic here. Similar to
                  the manual refund flow but for claiming received BTC.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      );
    }

    // BTC → Polygon: Show auto-claim UI
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
