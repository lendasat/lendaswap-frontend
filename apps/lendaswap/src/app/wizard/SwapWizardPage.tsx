import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  api,
  getTokenSymbol,
  SwapStatus,
  TokenId,
  GetSwapResponse,
  BtcToPolygonSwapResponse,
  PolygonToBtcSwapResponse,
} from "../api";
import { useAsyncRetry } from "react-use";
import {
  SendBitcoinStep,
  SwapProcessingStep,
  SuccessStep,
  PolygonDepositStep,
  BtcToPolygonRefundStep,
} from "./steps";
import { AlertCircle } from "lucide-react";
import { DEBUG_SWAP_ID, isDebugMode } from "../utils/debugMode";
import { getSwapById, updateSwap } from "../db";

type SwapDirection = "btc-to-polygon" | "polygon-to-btc";

type StepId =
  | "user-deposit"
  | "server-depositing"
  | "server-deposit"
  | "user-redeem"
  | "server-redeem"
  | "success"
  | "expired"
  | "refundable"
  | "refunded";

const isBtcToPolygon = (
  source_token: undefined | TokenId,
): SwapDirection | undefined => {
  if (source_token === "btc_arkade" || source_token === "btc_lightning") {
    return "btc-to-polygon";
  }

  if (source_token === "usdt_pol" || source_token === "usdc_pol") {
    return "polygon-to-btc";
  }

  return undefined;
};

// Create mock swap data for debug mode
function createMockSwapData(status: SwapStatus): GetSwapResponse {
  const mockData: any = {
    direction: "btc_to_polygon",
    id: DEBUG_SWAP_ID,
    status,
    source_token: "btc_lightning",
    target_token: "usdc_pol",
    hash_lock:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    fee_sats: 100,
    htlc_address_arkade:
      "ark1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpnwz7m",
    htlc_address_polygon: "0x0000000000000000000000000000000000000000",
    user_address_polygon: "0x1111111111111111111111111111111111111111",
    user_address_arkade:
      "ark1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpnwz7m",
    ln_invoice:
      "lnbc1000u1pjqqqqqpp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdqqcqzpgxqrrsssp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9qyyssqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
    sats_receive: 10000,
    sats_required: 10100, // sats_receive + fee_sats
    usd_amount: 100,
    created_at: new Date().toISOString(),
    sender_pk:
      "02cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    receiver_pk:
      "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    server_pk:
      "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    refund_locktime: Math.floor(Date.now() / 1000) + 3600,
    unilateral_claim_delay: 100,
    unilateral_refund_delay: 200,
    unilateral_refund_without_receiver_delay: 300,
    network: "regtest",
    bitcoin_htlc_claim_txid: null,
    bitcoin_htlc_fund_txid: null,
    polygon_htlc_claim_txid: null,
    polygon_htlc_fund_txid: null,
  };

  return mockData as GetSwapResponse;
}

function determineStepFromStatus(
  swapData: null | undefined | GetSwapResponse,
): StepId | undefined {
  if (!swapData) {
    return undefined;
  }

  const refundLocktimeDate = new Date(swapData.refund_locktime * 1000);

  const status = swapData.status;
  switch (status) {
    case "clientfunded":
    case "serverfunded":
    case "clientfundedserverrefunded":
    case "clientinvalidfunded":
    case "clientfundedtoolate":
      if (refundLocktimeDate < new Date()) {
        return "refundable";
      }
      break;
    default:
      // otherwise we just continue
      break;
  }

  switch (status) {
    case "pending":
      return "user-deposit";
    case "clientfunded":
      return "server-depositing";
    case "serverfunded":
      return "server-depositing";
    case "serverredeemed":
      return "success";
    case "clientredeeming":
    case "clientredeemed":
      return "success";
    case "expired":
      return "expired";
    case "clientfundedserverrefunded":
    case "clientinvalidfunded":
    case "clientfundedtoolate":
      return "refundable";
    case "clientrefundedserverfunded":
    case "clientrefundedserverrefunded":
    case "clientrefunded":
      return "refunded";
  }
}

export function SwapWizardPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lastStatusRef = useRef<SwapStatus | null>(null);
  const [displaySwapData, setDisplaySwapData] =
    useState<GetSwapResponse | null>(null);

  // Get debug step from URL query params
  const debugStep = searchParams.get("step") as SwapStatus | null;

  const {
    loading: isLoading,
    value: swapData,
    retry,
    error,
  } = useAsyncRetry(async () => {
    if (!swapId) {
      navigate("/", { replace: true });
      return;
    }

    // In debug mode, return mock data instead of calling API
    if (isDebugMode() && swapId === DEBUG_SWAP_ID) {
      const mockStatus: SwapStatus = debugStep || "pending";
      return createMockSwapData(mockStatus);
    }

    return getSwapById(swapId);
  }, [swapId, debugStep]);

  // Update display data when swap data changes and status is different
  useEffect(() => {
    if (swapData && swapData.status !== lastStatusRef.current) {
      console.log(
        `Status changed: ${lastStatusRef.current} -> ${swapData.status}`,
      );
      lastStatusRef.current = swapData.status;
      setDisplaySwapData(swapData);
    } else if (swapData && !displaySwapData) {
      // Initial load
      lastStatusRef.current = swapData.status;
      setDisplaySwapData(swapData);
    }
  }, [swapData, displaySwapData]);

  const swapDirection = isBtcToPolygon(displaySwapData?.source_token);

  const currentStep = determineStepFromStatus(displaySwapData);

  // Poll swap status every 2 seconds in the background
  useEffect(() => {
    if (!swapId) {
      return;
    }
    if (!swapData) {
      // swap was not found, so no need to poll
      return;
    }

    // Don't poll in debug mode
    if (isDebugMode() && swapId === DEBUG_SWAP_ID) {
      console.log("Debug mode: polling disabled");
      return;
    }

    // Stop polling if we've reached a terminal state
    const terminalStates: SwapStatus[] = [
      "serverredeemed",
      "expired",
      "clientrefundedserverfunded",
      "clientrefundedserverrefunded",
      "clientrefunded",
    ];

    if (displaySwapData && terminalStates.includes(displaySwapData.status)) {
      console.log(
        `Polling stopped: swap reached terminal state '${displaySwapData.status}'`,
      );
      return;
    }

    const pollInterval = setInterval(async () => {
      console.log("Background polling swap status from API...");
      try {
        // Fetch latest swap data from API
        const updatedSwap = await api.getSwap(swapId);

        // Check if anything has changed
        if (displaySwapData && updatedSwap.status !== displaySwapData.status) {
          console.log("Swap data changed, updating database...", {
            old: displaySwapData.status,
            new: updatedSwap.status,
          });

          // Update the database with the latest data
          await updateSwap(swapId, updatedSwap);

          // Trigger a re-fetch to update the UI
          retry();
        }
      } catch (error) {
        console.error("Failed to poll swap status:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [swapId, retry, displaySwapData]);

  return (
    <>
      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
          <div className="space-y-4 px-6 py-6 bg-destructive/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <h3 className="text-xl font-semibold text-destructive">
                Failed to Load Swap
              </h3>
            </div>
            <p className="text-muted-foreground">{error.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => retry()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Retry
              </button>
              <button
                onClick={() => navigate("/")}
                className="rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap Not Found State */}
      {!isLoading && !error && !swapData && swapId && (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
          <div className="space-y-4 px-6 py-6 bg-warning/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-warning" />
              <h3 className="text-xl font-semibold">Swap Not Found</h3>
            </div>
            <p className="text-muted-foreground">
              The swap with ID{" "}
              <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                {swapId}
              </code>{" "}
              could not be found.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/")}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go Home
              </button>
              <button
                onClick={() => navigate("/swaps")}
                className="rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                View All Swaps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !displaySwapData && (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-center py-12">
            <div className="border-muted border-t-foreground h-16 w-16 animate-spin rounded-full border-4" />
          </div>
        </div>
      )}

      {/* Step-specific content */}
      {displaySwapData && !error && (
        <>
          {currentStep === "user-deposit" &&
            swapDirection === "btc-to-polygon" && (
              <SendBitcoinStep
                arkadeAddress={displaySwapData.htlc_address_arkade}
                lightningAddress={displaySwapData.ln_invoice}
                unifiedAddress={`bitcoin:?arkade=${displaySwapData.htlc_address_arkade}&lightning=${displaySwapData.ln_invoice}&amount=${displaySwapData.sats_receive / 100_000_000}`}
                swapData={displaySwapData as BtcToPolygonSwapResponse}
                usdcAmount={displaySwapData.usd_amount.toFixed(2)}
                tokenSymbol={getTokenSymbol(displaySwapData.target_token)}
                swapId={displaySwapData.id}
              />
            )}

          {currentStep === "user-deposit" &&
            swapDirection === "polygon-to-btc" && (
              <PolygonDepositStep
                swapData={displaySwapData as PolygonToBtcSwapResponse}
                swapId={displaySwapData.id}
              />
            )}

          {currentStep === "server-deposit" && (
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
              {/* Swap ID Header */}
              <div className="px-6 py-4 flex items-center gap-3 border-b border-border/50 bg-muted/30">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Swap ID:
                </p>
                <code className="text-xs font-mono text-foreground flex-1">
                  {displaySwapData.id}
                </code>
                <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
              </div>

              {/* Content */}
              <div className="space-y-4 p-6">
                <h3 className="text-xl font-semibold">Processing Swap</h3>
                <p className="text-muted-foreground">
                  Please wait while we confirm your deposit and process the
                  swap...
                </p>
                <div className="flex items-center justify-center py-12">
                  <div className="border-muted border-t-primary h-16 w-16 animate-spin rounded-full border-4" />
                </div>
              </div>
            </div>
          )}

          {swapDirection && currentStep === "server-depositing" && (
            <SwapProcessingStep
              swapData={displaySwapData}
              swapDirection={swapDirection}
              swapId={displaySwapData.id}
            />
          )}

          {currentStep === "success" && swapDirection && (
            <SuccessStep
              swapData={displaySwapData}
              swapDirection={swapDirection}
              swapId={displaySwapData.id}
            />
          )}

          {currentStep === "expired" && (
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
              {/* Swap ID Header */}
              <div className="px-6 py-4 flex items-center gap-3 border-b border-border/50 bg-muted/30">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Swap ID:
                </p>
                <code className="text-xs font-mono text-foreground flex-1">
                  {displaySwapData.id}
                </code>
                <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
              </div>

              {/* Content */}
              <div className="space-y-4 p-6">
                <h3 className="text-xl font-semibold text-destructive">
                  Swap Expired
                </h3>
                <p className="text-muted-foreground">
                  This swap has expired. The time window to complete the swap
                  has passed.
                </p>
              </div>
            </div>
          )}

          {currentStep === "refundable" &&
            swapDirection === "btc-to-polygon" && (
              <BtcToPolygonRefundStep
                swapData={displaySwapData as BtcToPolygonSwapResponse}
                swapId={displaySwapData.id}
              />
            )}


          {currentStep === "refunded" && (
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
              {/* Swap ID Header */}
              <div className="px-6 py-4 flex items-center gap-3 border-b border-border/50 bg-muted/30">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Swap ID:
                </p>
                <code className="text-xs font-mono text-foreground flex-1">
                  {displaySwapData.id}
                </code>
                <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
              </div>

              {/* Content */}
              <div className="space-y-4 p-6">
                <h3 className="text-xl font-semibold">Swap Refunded</h3>
                <p className="text-muted-foreground">
                  Your funds have been refunded successfully.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
