import {
  type ExtendedSwapStorageData,
  TokenId,
  type TokenInfo,
} from "@lendasat/lendaswap-sdk";
import { AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAsync, useAsyncRetry } from "react-use";
import {
  api,
  type BtcToArkadeSwapResponse,
  type BtcToEvmSwapResponse,
  type EvmToBtcSwapResponse,
  type GetSwapResponse,
  SwapStatus,
} from "../api";
import { DEBUG_SWAP_ID, isDebugMode } from "../utils/debugMode";
import { useWalletBridge } from "../WalletBridgeContext";
import {
  BtcToArkadeProcessingStep,
  BtcToPolygonRefundStep,
  OnchainBtcRefundStep,
  PolygonDepositStep,
  PolygonToBtcRefundStep,
  SendArkadeStep,
  SendOnchainBtcStep,
  SuccessStep,
  SwapProcessingStep,
} from "./steps";
import { SendLightningStep } from "./steps/SendLightningStep";

export type SwapDirection = "btc-to-evm" | "evm-to-btc" | "btc-to-arkade";

type StepId =
  | "user-deposit"
  | "user-deposit-seen"
  | "server-depositing"
  | "server-deposit"
  | "user-redeem"
  | "server-redeem"
  | "success"
  | "expired"
  | "refundable"
  | "refunded";

const swapDirection = (
  swapData: undefined | null | GetSwapResponse,
): SwapDirection | undefined => {
  if (!swapData) {
    return undefined;
  }

  if (
    (swapData.source_token.isArkade() || swapData.source_token.isLightning()) &&
    swapData.target_token.isEvmToken()
  ) {
    return "btc-to-evm";
  } else if (
    (swapData.target_token.isArkade() || swapData.target_token.isLightning()) &&
    swapData.source_token.isEvmToken()
  ) {
    return "evm-to-btc";
  } else if (
    swapData.source_token.isBtcOnchain() &&
    swapData.target_token.isArkade()
  ) {
    return "btc-to-arkade";
  } else {
    return undefined;
  }
};

// Create mock swap data for debug mode
function createMockSwapData(status: SwapStatus): ExtendedSwapStorageData {
  const mockData = {
    direction: "btc_to_evm",
    id: DEBUG_SWAP_ID,
    status,
    source_token: "btc_lightning",
    target_token: "usdc_pol",
    hash_lock:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    fee_sats: 100,
    htlc_address_arkade:
      "ark1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpnwz7m",
    htlc_address_evm: "0x0000000000000000000000000000000000000000",
    user_address_evm: "0x1111111111111111111111111111111111111111",
    user_address_arkade:
      "ark1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpnwz7m",
    ln_invoice:
      "lnbc1000u1pjqqqqqpp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdqqcqzpgxqrrsssp5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9qyyssqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
    sats_receive: 10000,
    sats_required: 10100, // sats_receive + fee_sats
    asset_amount: 100,
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
    evm_htlc_claim_txid: null,
    evm_htlc_fund_txid: null,
    create_swap_tx: null,
    approve_tx: null,
    gelato_forwarder_address: null,
    gelato_user_nonce: null,
    gelato_user_deadline: null,
    source_token_address: null,
  };

  return {
    response: mockData as unknown as EvmToBtcSwapResponse,
  } as ExtendedSwapStorageData;
}

function determineStepFromStatus(
  swapData: null | undefined | GetSwapResponse,
): StepId | undefined {
  if (!swapData) {
    return undefined;
  }

  // Get refund locktime based on swap type
  // BtcToArkadeSwapResponse has btc_refund_locktime, others have refund_locktime
  const refundLocktime =
    "btc_refund_locktime" in swapData
      ? swapData.btc_refund_locktime
      : "refund_locktime" in swapData
        ? swapData.refund_locktime
        : undefined;

  const refundLocktimeDate = refundLocktime
    ? new Date(Number(refundLocktime) * 1000)
    : undefined;

  const status = swapData.status;
  switch (status) {
    case SwapStatus.ClientFundingSeen:
    case SwapStatus.ClientFunded:
    case SwapStatus.ServerFunded:
    case SwapStatus.ClientFundedServerRefunded:
    case SwapStatus.ClientInvalidFunded:
    case SwapStatus.ClientFundedTooLate:
      if (refundLocktimeDate && refundLocktimeDate < new Date()) {
        console.warn(`Refund timelock expired. Ready to refund.`);
        return "refundable";
      }
      break;
    default:
      // otherwise we just continue
      break;
  }

  switch (status) {
    case SwapStatus.Pending:
      return "user-deposit";
    case SwapStatus.ClientFundingSeen:
      return "user-deposit-seen";
    case SwapStatus.ClientFunded:
      return "server-depositing";
    case SwapStatus.ServerFunded:
      return "server-depositing";
    case SwapStatus.ServerRedeemed:
      return "success";
    case SwapStatus.ClientRedeeming:
    case SwapStatus.ClientRedeemed:
      return "success";
    case SwapStatus.Expired:
      return "expired";
    case SwapStatus.ClientFundedServerRefunded:
    case SwapStatus.ClientInvalidFunded:
    case SwapStatus.ClientFundedTooLate:
      return "refundable";
    case SwapStatus.ClientRefundedServerFunded:
    case SwapStatus.ClientRefundedServerRefunded:
    case SwapStatus.ClientRefunded:
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
  const [currentStep, setCurrentStep] = useState<StepId | undefined>();
  const [preimage, setPreimage] = useState<string | null>(null);
  const { arkAddress } = useWalletBridge();

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
      const mockStatus: SwapStatus = debugStep || SwapStatus.Pending;
      return createMockSwapData(mockStatus);
    }
    return await api.getSwap(swapId);
  }, [swapId, debugStep]);

  if (error) {
    console.error(`Failed fetching swap ${error}`);
  }

  // Update display data when swap data changes and status is different
  useEffect(() => {
    if (swapData && swapData.response.status !== lastStatusRef.current) {
      console.log(
        `Status changed: ${lastStatusRef.current} -> ${swapData.response.status}`,
      );
      lastStatusRef.current = swapData.response.status;
      setDisplaySwapData(swapData.response);
      setPreimage(swapData.swap_params.preimage);
      setCurrentStep(determineStepFromStatus(swapData.response));
    } else if (swapData && !displaySwapData) {
      // Initial load
      lastStatusRef.current = swapData.response.status;
      setDisplaySwapData(swapData.response);
      setPreimage(swapData.swap_params.preimage);
      setCurrentStep(determineStepFromStatus(swapData.response));
    }
  }, [swapData, displaySwapData]);

  const swapDirectionValue = swapDirection(displaySwapData);

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
      SwapStatus.ServerRedeemed,
      SwapStatus.Expired,
      SwapStatus.ClientRefundedServerFunded,
      SwapStatus.ClientRefundedServerRefunded,
      SwapStatus.ClientRefunded,
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

        // check if we can refund already
        const possibleNextStep = determineStepFromStatus(updatedSwap.response);

        // Check if anything has changed
        if (
          displaySwapData &&
          updatedSwap.response.status !== displaySwapData.status
        ) {
          // Trigger a re-fetch to update the UI
          retry();
        } else if (possibleNextStep && possibleNextStep === "refundable") {
          retry();
        }
      } catch (error) {
        console.error("Failed to poll swap status:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [swapId, retry, displaySwapData, swapData]);

  const { value: maybeTokens, error: loadingTokensError } = useAsync(
    async () => {
      return await api.getTokens();
    },
  );
  if (loadingTokensError) {
    console.error("Failed loading tokens", loadingTokensError);
  }

  const tokens = maybeTokens || [];
  let targetTokenInfo: TokenInfo | undefined;

  if (swapData?.response.target_token.isEvmToken()) {
    targetTokenInfo = tokens.find(
      (t) =>
        t.token_id.toString() === swapData.response.target_token.toString(),
    );
  } else {
    targetTokenInfo = tokens.find(
      (t) =>
        t.token_id.toString() === swapData?.response.source_token.toString(),
    );
  }

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
            <p className="text-muted-foreground">{JSON.stringify(error)}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => retry()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Retry
              </button>
              <button
                type="button"
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
                type="button"
                onClick={() => navigate("/")}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go Home
              </button>
              <button
                type="button"
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
            swapDirectionValue === "btc-to-evm" &&
            swapData?.response.source_token.toString() ===
              TokenId.btcArkade().toString() && (
              <SendArkadeStep
                swapData={displaySwapData as BtcToEvmSwapResponse}
              />
            )}
          {currentStep === "user-deposit" &&
            swapDirectionValue === "btc-to-evm" &&
            swapData?.response.source_token.toString() ===
              TokenId.btcLightning().toString() && (
              <SendLightningStep
                swapData={displaySwapData as BtcToEvmSwapResponse}
              />
            )}
          {currentStep === "user-deposit" &&
            swapDirectionValue === "btc-to-arkade" && (
              <SendOnchainBtcStep
                swapData={displaySwapData as BtcToArkadeSwapResponse}
                swapId={displaySwapData.id}
              />
            )}
          {targetTokenInfo &&
            currentStep === "user-deposit" &&
            swapDirectionValue === "evm-to-btc" && (
              <PolygonDepositStep
                swapData={displaySwapData as EvmToBtcSwapResponse}
                swapId={displaySwapData.id}
                tokenInfo={targetTokenInfo}
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

          {swapDirectionValue &&
            (currentStep === "user-deposit-seen" ||
              currentStep === "server-depositing") &&
            swapDirectionValue !== "btc-to-arkade" && (
              <SwapProcessingStep
                swapData={displaySwapData}
                swapDirection={swapDirectionValue}
                swapId={displaySwapData.id}
                preimage={preimage}
              />
            )}
          {(currentStep === "user-deposit-seen" ||
            currentStep === "server-depositing") &&
            swapDirectionValue === "btc-to-arkade" && (
              <BtcToArkadeProcessingStep
                swapData={displaySwapData as BtcToArkadeSwapResponse}
                swapId={displaySwapData.id}
                preimage={preimage}
              />
            )}

          {currentStep === "success" && swapDirectionValue && (
            <SuccessStep
              swapData={displaySwapData}
              swapDirection={swapDirectionValue}
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
            swapDirectionValue === "btc-to-evm" && (
              <BtcToPolygonRefundStep
                swapData={displaySwapData as BtcToEvmSwapResponse}
                swapId={displaySwapData.id}
                arkAddress={arkAddress}
              />
            )}

          {currentStep === "refundable" &&
            swapDirectionValue === "evm-to-btc" && (
              <PolygonToBtcRefundStep
                swapData={displaySwapData as EvmToBtcSwapResponse}
                swapId={displaySwapData.id}
              />
            )}

          {currentStep === "refundable" &&
            swapDirectionValue === "btc-to-arkade" && (
              <OnchainBtcRefundStep
                swapData={displaySwapData as BtcToArkadeSwapResponse}
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
