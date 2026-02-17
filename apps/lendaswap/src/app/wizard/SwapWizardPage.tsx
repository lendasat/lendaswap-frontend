import type {
  ArkadeToEvmSwapResponse,
  BitcoinToEvmSwapResponse,
  BtcToArkadeSwapResponse,
  EvmToArkadeSwapResponse,
  EvmToBitcoinSwapResponse,
  EvmToLightningSwapResponse,
  GetSwapResponse,
  LightningToEvmSwapResponse,
  SwapStatus,
} from "@lendasat/lendaswap-sdk-pure";
import { AlertCircle } from "lucide-react";
import { BitcoinDepositStep, DepositArkadeStep, EvmDepositStep } from "./steps";
import { SendLightningStep } from "./steps/SendLightningStep";
import { useNavigate, useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useAsyncRetry } from "react-use";
import { api } from "../api";

export type SwapDirection =
  | "btc-to-evm"
  | "evm-to-btc"
  | "btc-to-arkade"
  | "onchain-to-evm"
  | "arkade-to-evm"
  | "evm-to-arkade";

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

function determineStepFromStatus(
  swapData: null | undefined | GetSwapResponse,
): StepId | undefined {
  if (!swapData) {
    return undefined;
  }

  // Get the user-side refund locktime based on swap direction
  const getRefundLocktime = (): number | undefined => {
    switch (swapData.direction) {
      case "btc_to_arkade":
        return swapData.vhtlc_refund_locktime;
      case "bitcoin_to_evm":
        return swapData.evm_refund_locktime;
      case "arkade_to_evm":
        return swapData.vhtlc_refund_locktime;
      case "evm_to_arkade":
        return swapData.evm_refund_locktime;
      case "evm_to_bitcoin":
        return swapData.evm_refund_locktime;
      case "lightning_to_evm":
        return swapData.vhtlc_refund_locktime;
      case "evm_to_lightning":
        return swapData.evm_refund_locktime;
    }
  };
  const refundLocktime = getRefundLocktime();

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
  // const posthog = usePostHog();
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();

  //
  useEffect(() => {
    document.title = "Swap in Progress | LendaSwap";
  }, []);

  const lastStatusRef = useRef<SwapStatus | null>(null);
  const [displaySwapData, setDisplaySwapData] =
    useState<GetSwapResponse | null>(null);
  const [currentStep, setCurrentStep] = useState<StepId | undefined>();
  // const [preimage, setPreimage] = useState<string | null>(null);
  // const { arkAddress } = useWalletBridge();

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

    return await api.getSwap(swapId);
  }, [swapId]);

  if (error) {
    // TODO: show error in frontend
    console.error(`Failed fetching swap ${error}`);
  }

  // Update display data when swap data changes and status is different
  useEffect(() => {
    if (!swapData) return;

    const statusChanged = swapData.response.status !== lastStatusRef.current;
    const directionChanged =
      displaySwapData &&
      (swapData.response.source_token !== displaySwapData.source_token ||
        swapData.response.target_token !== displaySwapData.target_token);

    if (statusChanged || directionChanged || !displaySwapData) {
      console.log(
        `Swap data updated: status=${swapData.response.status}, source=${swapData.response.source_token}, target=${swapData.response.target_token}`,
      );
      lastStatusRef.current = swapData.response.status;
      setDisplaySwapData(swapData.response);
      setCurrentStep(determineStepFromStatus(swapData.response));
    }
  }, [swapData, displaySwapData]);
  //
  const swapDirectionValue = displaySwapData?.direction;
  //
  // // Track wizard step views for conversion funnel
  // useEffect(() => {
  //   if (!currentStep || !displaySwapData) return;
  //   posthog?.capture("swap_step_viewed", {
  //     swap_id: displaySwapData.id,
  //     step: currentStep,
  //     swap_direction: swapDirectionValue,
  //   });
  // }, [currentStep, displaySwapData, posthog?.capture, swapDirectionValue]);
  //
  // Poll swap status every 2 seconds in the background
  useEffect(() => {
    if (!swapId) {
      return;
    }
    if (!swapData) {
      // swap was not found, so no need to poll
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
  //
  // const { value: maybeTokens, error: loadingTokensError } = useAsync(
  //   async () => {
  //     return await api.getTokens();
  //   },
  // );
  // if (loadingTokensError) {
  //   console.error("Failed loading tokens", loadingTokensError);
  // }
  //
  // const tokens = maybeTokens || [];
  // let targetTokenInfo: TokenInfo | undefined;
  //
  // if (swapData && isEvmToken(swapData.response.target_token)) {
  //   targetTokenInfo = tokens.find(
  //     (t) => t.token_id === swapData.response.target_token,
  //   );
  // } else {
  //   targetTokenInfo = tokens.find(
  //     (t) => t.token_id === swapData?.response.source_token,
  //   );
  // }
  //
  // // In debug mode, provide mock token info if API didn't return tokens
  // if (isDebugMode() && !targetTokenInfo && swapData) {
  //   const tokenId = isEvmToken(swapData.response.target_token)
  //     ? swapData.response.target_token
  //     : swapData.response.source_token;
  //   targetTokenInfo = {
  //     token_id: tokenId,
  //     symbol: tokenId.split("_")[0]?.toUpperCase() ?? "MOCK",
  //     name: tokenId,
  //     decimals: tokenId.startsWith("btc") ? 8 : 6,
  //     chain: "polygon",
  //   } as TokenInfo;
  // }

  return (
    <>
      {/!* Error State *!/}
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

      {/!* Swap Not Found State *!/}
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

      {/!* Loading State *!/}
      {isLoading && !displaySwapData && (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-center py-12">
            <div className="border-muted border-t-foreground h-16 w-16 animate-spin rounded-full border-4" />
          </div>
        </div>
      )}

      {/!* Step-specific content *!/}
      {displaySwapData && !error && (
        <>
          {currentStep === "user-deposit" && (
            <>
              {swapDirectionValue === "arkade_to_evm" && (
                <DepositArkadeStep
                  swapData={displaySwapData as ArkadeToEvmSwapResponse}
                />
              )}
              {swapDirectionValue === "lightning_to_evm" && (
                <SendLightningStep
                  swapData={displaySwapData as LightningToEvmSwapResponse}
                />
              )}
              {(swapDirectionValue === "bitcoin_to_evm" ||
                swapDirectionValue === "btc_to_arkade") && (
                <BitcoinDepositStep
                  swapData={
                    displaySwapData as
                      | BtcToArkadeSwapResponse
                      | BitcoinToEvmSwapResponse
                  }
                  swapId={displaySwapData.id}
                />
              )}
              {(swapDirectionValue === "evm_to_arkade" ||
                swapDirectionValue === "evm_to_bitcoin" ||
                swapDirectionValue === "evm_to_lightning") && (
                <EvmDepositStep
                  swapData={
                    displaySwapData as
                      | EvmToArkadeSwapResponse
                      | EvmToBitcoinSwapResponse
                      | EvmToLightningSwapResponse
                  }
                  swapId={displaySwapData.id}
                />
              )}
            </>
          )}

          {currentStep === "server-deposit" && (
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-3 border-b border-border/50 bg-muted/30">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Swap ID:
                </p>
                <code className="text-xs font-mono text-foreground flex-1">
                  {displaySwapData.id}
                </code>
                <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
              </div>

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

          {/*{swapDirectionValue &&*/}
          {/*  (currentStep === "user-deposit-seen" ||*/}
          {/*    currentStep === "server-depositing") &&*/}
          {/*  swapDirectionValue !== "btc-to-arkade" &&*/}
          {/*  swapDirectionValue !== "arkade-to-evm" &&*/}
          {/*  swapDirectionValue !== "evm-to-arkade" && (*/}
          {/*    <SwapProcessingStep*/}
          {/*      swapData={displaySwapData}*/}
          {/*      swapId={displaySwapData.id}*/}
          {/*    />*/}
          {/*  )}*/}
          {/*{(currentStep === "user-deposit-seen" ||*/}
          {/*  currentStep === "server-depositing") &&*/}
          {/*  swapDirectionValue === "btc-to-arkade" && (*/}
          {/*    <BtcToArkadeProcessingStep*/}
          {/*      swapData={displaySwapData as BtcToArkadeSwapResponse}*/}
          {/*      swapId={displaySwapData.id}*/}
          {/*      preimage={preimage}*/}
          {/*    />*/}
          {/*  )}*/}
          {/*{(currentStep === "user-deposit-seen" ||*/}
          {/*  currentStep === "server-depositing") &&*/}
          {/*  swapDirectionValue === "arkade-to-evm" && (*/}
          {/*    <ClaimEvmStep*/}
          {/*      swapData={displaySwapData}*/}
          {/*      swapId={displaySwapData.id}*/}
          {/*    />*/}
          {/*  )}*/}
          {/*{(currentStep === "user-deposit-seen" ||*/}
          {/*  currentStep === "server-depositing") &&*/}
          {/*  swapDirectionValue === "evm-to-arkade" && (*/}
          {/*    <ClaimArkadeStep*/}
          {/*      swapData={displaySwapData}*/}
          {/*      swapId={displaySwapData.id}*/}
          {/*    />*/}
          {/*  )}*/}

          {/*{currentStep === "success" && swapDirectionValue && (*/}
          {/*  <SuccessStep*/}
          {/*    swapData={displaySwapData}*/}
          {/*    swapDirection={swapDirectionValue}*/}
          {/*    swapId={displaySwapData.id}*/}
          {/*  />*/}
          {/*)}*/}

          {currentStep === "expired" && (
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-3 border-b border-border/50 bg-muted/30">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Swap ID:
                </p>
                <code className="text-xs font-mono text-foreground flex-1">
                  {displaySwapData.id}
                </code>
                <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
              </div>

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

          {/*{currentStep === "refundable" &&*/}
          {/*  swapDirectionValue === "btc-to-evm" && (*/}
          {/*    <BtcToPolygonRefundStep*/}
          {/*      swapData={displaySwapData as BtcToEvmSwapResponse}*/}
          {/*      swapId={displaySwapData.id}*/}
          {/*      arkAddress={arkAddress}*/}
          {/*    />*/}
          {/*  )}*/}

          {/*{currentStep === "refundable" &&*/}
          {/*  swapDirectionValue === "evm-to-btc" && (*/}
          {/*    <PolygonToBtcRefundStep*/}
          {/*      swapData={displaySwapData as EvmToBtcSwapResponse}*/}
          {/*      swapId={displaySwapData.id}*/}
          {/*    />*/}
          {/*  )}*/}

          {/*{currentStep === "refundable" &&*/}
          {/*  (swapDirectionValue === "btc-to-arkade" ||*/}
          {/*    swapDirectionValue === "onchain-to-evm") && (*/}
          {/*    <OnchainBtcRefundStep*/}
          {/*      swapData={*/}
          {/*        displaySwapData as*/}
          {/*          | BtcToArkadeSwapResponse*/}
          {/*          | OnchainToEvmSwapResponse*/}
          {/*      }*/}
          {/*      swapId={displaySwapData.id}*/}
          {/*    />*/}
          {/*  )}*/}

          {/*{currentStep === "refundable" &&*/}
          {/*  swapDirectionValue === "arkade-to-evm" && (*/}
          {/*    <RefundArkadeStep*/}
          {/*      swapData={displaySwapData as ArkadeToEvmSwapResponse}*/}
          {/*      swapId={displaySwapData.id}*/}
          {/*      arkAddress={arkAddress}*/}
          {/*    />*/}
          {/*  )}*/}

          {/*{currentStep === "refundable" &&*/}
          {/*  swapDirectionValue === "evm-to-arkade" && (*/}
          {/*    <RefundEvmStep*/}
          {/*      swapData={displaySwapData as EvmToArkadeSwapResponse}*/}
          {/*      swapId={displaySwapData.id}*/}
          {/*    />*/}
          {/*  )}*/}

          {currentStep === "refunded" && (
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-3 border-b border-border/50 bg-muted/30">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Swap ID:
                </p>
                <code className="text-xs font-mono text-foreground flex-1">
                  {displaySwapData.id}
                </code>
                <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
              </div>

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
