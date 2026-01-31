import {
  BTC_ARKADE,
  BTC_LIGHTNING,
  type BtcToArkadeSwapResponse,
  type BtcToEvmSwapResponse,
  type EvmToBtcSwapResponse,
  type GetSwapResponse,
  isArkade,
  isBtcOnchain,
  isEvmToken,
  isLightning,
  type OnchainToEvmSwapResponse,
  type StoredSwap,
  type SwapStatus,
  type TokenInfo,
} from "@lendasat/lendaswap-sdk-pure";
import { AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAsync, useAsyncRetry } from "react-use";
import { api } from "../api";
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

export type SwapDirection =
  | "btc-to-evm"
  | "evm-to-btc"
  | "btc-to-arkade"
  | "onchain-to-evm";

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
    (isArkade(swapData.source_token) || isLightning(swapData.source_token)) &&
    isEvmToken(swapData.target_token)
  ) {
    return "btc-to-evm";
  } else if (
    (isArkade(swapData.target_token) || isLightning(swapData.target_token)) &&
    isEvmToken(swapData.source_token)
  ) {
    return "evm-to-btc";
  } else if (
    isBtcOnchain(swapData.source_token) &&
    isArkade(swapData.target_token)
  ) {
    return "btc-to-arkade";
  } else if (
    isBtcOnchain(swapData.source_token) &&
    isEvmToken(swapData.target_token)
  ) {
    return "onchain-to-evm";
  } else {
    return undefined;
  }
};

// Debug direction presets: source_token → target_token mappings
type DebugDirection =
  | "lightning-to-evm"
  | "arkade-to-evm"
  | "onchain-to-evm"
  | "onchain-to-arkade"
  | "evm-to-lightning"
  | "evm-to-arkade";

const DEBUG_DIRECTION_CONFIGS: Record<
  DebugDirection,
  { source_token: string; target_token: string; direction: string }
> = {
  "lightning-to-evm": {
    source_token: "btc_lightning",
    target_token: "usdc_pol",
    direction: "btc_to_evm",
  },
  "arkade-to-evm": {
    source_token: "btc_arkade",
    target_token: "usdc_pol",
    direction: "btc_to_evm",
  },
  "onchain-to-evm": {
    source_token: "btc_onchain",
    target_token: "usdc_pol",
    direction: "onchain_to_evm",
  },
  "onchain-to-arkade": {
    source_token: "btc_onchain",
    target_token: "btc_arkade",
    direction: "btc_to_arkade",
  },
  "evm-to-lightning": {
    source_token: "usdc_pol",
    target_token: "btc_lightning",
    direction: "evm_to_btc",
  },
  "evm-to-arkade": {
    source_token: "usdc_pol",
    target_token: "btc_arkade",
    direction: "evm_to_btc",
  },
};

// Create mock swap data for debug mode
function createMockSwapData(
  status: SwapStatus,
  debugDirection?: string | null,
): StoredSwap {
  const dirConfig =
    DEBUG_DIRECTION_CONFIGS[
      (debugDirection as DebugDirection) || "lightning-to-evm"
    ] ?? DEBUG_DIRECTION_CONFIGS["lightning-to-evm"];

  const mockData = {
    direction: dirConfig.direction,
    id: DEBUG_SWAP_ID,
    status,
    source_token: dirConfig.source_token,
    target_token: dirConfig.target_token,
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
    sats_required: 10100,
    source_amount: 10100,
    target_amount: 100,
    asset_amount: 100,
    created_at: new Date().toISOString(),
    sender_pk:
      "02cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    receiver_pk:
      "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    server_pk:
      "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    btc_refund_locktime: Math.floor(Date.now() / 1000) + 3600,
    refund_locktime: Math.floor(Date.now() / 1000) + 3600,
    btc_htlc_address: "bc1qmock0000000000000000000000000000000000mock",
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
    source_token_address: "0x2222222222222222222222222222222222222222",
  };

  return {
    response: mockData as unknown as GetSwapResponse,
    preimage: "mock_preimage",
    preimageHash: "mock_hash",
    publicKey: "mock_pk",
    secretKey: "mock_sk",
    swapId: DEBUG_SWAP_ID,
    keyIndex: 0,
    version: 1,
    storedAt: Date.now(),
    updatedAt: Date.now(),
  } satisfies StoredSwap;
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
    case "clientfundingseen":
    case "clientfunded":
    case "serverfunded":
    case "clientfundedserverrefunded":
    case "clientinvalidfunded":
    case "clientfundedtoolate":
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
    case "pending":
      return "user-deposit";
    case "clientfundingseen":
      return "user-deposit-seen";
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
  const [currentStep, setCurrentStep] = useState<StepId | undefined>();
  const [preimage, setPreimage] = useState<string | null>(null);
  const { arkAddress } = useWalletBridge();

  useEffect(() => {
    document.title = "Swap in Progress | LendaSwap";
  }, []);

  // Debug-only: read step/direction from URL query params for UI preview
  const debugStep = isDebugMode()
    ? (searchParams.get("step") as SwapStatus | null)
    : null;
  const debugDirection = isDebugMode() ? searchParams.get("direction") : null;

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

    // Debug mode only: return mock data instead of calling API
    if (isDebugMode() && swapId === DEBUG_SWAP_ID) {
      const mockStatus: SwapStatus = (debugStep as SwapStatus) || "pending";
      return createMockSwapData(mockStatus, debugDirection);
    }
    return await api.getSwap(swapId);
  }, [swapId, debugStep, debugDirection]);

  if (error) {
    console.error(`Failed fetching swap ${error}`);
  }

  // Update display data when swap data changes and status is different
  useEffect(() => {
    if (!swapData) return;

    const statusChanged = swapData.response.status !== lastStatusRef.current;
    // Debug mode: also detect direction changes (same status, different tokens)
    const directionChanged =
      isDebugMode() &&
      displaySwapData &&
      (swapData.response.source_token !== displaySwapData.source_token ||
        swapData.response.target_token !== displaySwapData.target_token);

    if (statusChanged || directionChanged || !displaySwapData) {
      console.log(
        `Swap data updated: status=${swapData.response.status}, source=${swapData.response.source_token}, target=${swapData.response.target_token}`,
      );
      lastStatusRef.current = swapData.response.status;
      setDisplaySwapData(swapData.response);
      setPreimage(swapData.preimage);
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

  if (swapData && isEvmToken(swapData.response.target_token)) {
    targetTokenInfo = tokens.find(
      (t) => t.token_id === swapData.response.target_token,
    );
  } else {
    targetTokenInfo = tokens.find(
      (t) => t.token_id === swapData?.response.source_token,
    );
  }

  // In debug mode, provide mock token info if API didn't return tokens
  if (isDebugMode() && !targetTokenInfo && swapData) {
    const tokenId = isEvmToken(swapData.response.target_token)
      ? swapData.response.target_token
      : swapData.response.source_token;
    targetTokenInfo = {
      token_id: tokenId,
      symbol: tokenId.split("_")[0]?.toUpperCase() ?? "MOCK",
      name: tokenId,
      decimals: tokenId.startsWith("btc") ? 8 : 6,
      chain: "polygon",
    } as TokenInfo;
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
            swapData?.response.source_token === BTC_ARKADE && (
              <SendArkadeStep
                swapData={displaySwapData as BtcToEvmSwapResponse}
              />
            )}
          {currentStep === "user-deposit" &&
            swapDirectionValue === "btc-to-evm" &&
            swapData?.response.source_token === BTC_LIGHTNING && (
              <SendLightningStep
                swapData={displaySwapData as BtcToEvmSwapResponse}
              />
            )}
          {targetTokenInfo &&
            currentStep === "user-deposit" &&
            (swapDirectionValue === "btc-to-arkade" ||
              swapDirectionValue === "onchain-to-evm") && (
              <SendOnchainBtcStep
                swapData={
                  displaySwapData as
                    | BtcToArkadeSwapResponse
                    | OnchainToEvmSwapResponse
                }
                swapId={displaySwapData.id}
                targetTokenInfo={targetTokenInfo}
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
            (swapDirectionValue === "btc-to-arkade" ||
              swapDirectionValue === "onchain-to-evm") && (
              <OnchainBtcRefundStep
                swapData={
                  displaySwapData as
                    | BtcToArkadeSwapResponse
                    | OnchainToEvmSwapResponse
                }
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
