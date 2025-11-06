import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent } from "#/components/ui/card";
import {
  api,
  getTokenSymbol,
  SwapStatus,
  TokenId,
  GetSwapResponse,
  BtcToPolygonSwapResponse,
  PolygonToBtcSwapResponse,
} from "../api";
import { WizardSteps } from "./WizardSteps";
import { useAsyncRetry } from "react-use";
import {
  SendBitcoinStep,
  SwapProcessingStep,
  SuccessStep,
  PolygonDepositStep,
} from "./steps";
import { AlertCircle } from "lucide-react";

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

interface Step {
  id: StepId;
  label: string;
  labelCompleted?: string;
  status: "completed" | "current" | "upcoming";
}

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

function determineStepFromStatus(
  status: undefined | SwapStatus,
): StepId | undefined {
  if (!status) {
    return undefined;
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
  const lastStatusRef = useRef<SwapStatus | null>(null);
  const [displaySwapData, setDisplaySwapData] =
    useState<GetSwapResponse | null>(null);

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
  });

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

  const currentStep = determineStepFromStatus(displaySwapData?.status);

  // Poll swap status every 2 seconds in the background
  useEffect(() => {
    if (!swapId) {
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
      console.log("Background polling swap status...");
      retry();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [swapId, retry, displaySwapData]);

  // Determine step from swap status

  // Build steps based on swap direction
  const buildSteps = (): Step[] => {
    if (!swapDirection || !currentStep) return [];

    const completedSteps: StepId[] = [
      "server-depositing",
      "server-deposit",
      "user-redeem",
      "success",
    ];

    if (swapDirection === "btc-to-polygon") {
      return [
        {
          id: "user-deposit",
          label: "Waiting for deposit",
          labelCompleted: "Deposited",
          status:
            currentStep === "user-deposit"
              ? "current"
              : completedSteps.includes(currentStep)
                ? "completed"
                : "upcoming",
        },
        {
          id: "server-deposit",
          label: "Swapping",
          labelCompleted: "Swapped",
          status:
            currentStep === "server-depositing" ||
            currentStep === "server-deposit" ||
            currentStep === "user-redeem"
              ? "current"
              : currentStep === "success"
                ? "completed"
                : "upcoming",
        },
        {
          id: "success",
          label: "Finished",
          status: currentStep === "success" ? "current" : "upcoming",
        },
      ];
    }

    // polygon-to-btc
    return [
      {
        id: "user-deposit",
        label: "Waiting for deposit",
        labelCompleted: "Deposited",
        status:
          currentStep === "user-deposit"
            ? "current"
            : completedSteps.includes(currentStep)
              ? "completed"
              : "upcoming",
      },
      {
        id: "server-deposit",
        label: "Swapping",
        labelCompleted: "Swapped",
        status:
          currentStep === "server-depositing" ||
          currentStep === "server-deposit" ||
          currentStep === "user-redeem"
            ? "current"
            : currentStep === "success"
              ? "completed"
              : "upcoming",
      },
      {
        id: "success",
        label: "Finished",
        status: currentStep === "success" ? "current" : "upcoming",
      },
    ];
  };

  const steps = buildSteps();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Swap ID Header */}
        {displaySwapData && (
          <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Swap ID:
            </p>
            <code className="text-xs font-mono text-foreground flex-1">
              {displaySwapData.id}
            </code>
            <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
          </div>
        )}

        {/* Step Content Card */}
        <Card className="border-border/50 shadow-xl backdrop-blur-sm bg-card/80">
          <CardContent className="space-y-6 p-0">
            {/* Error State */}
            {error && (
              <Card className="border-destructive/50 bg-destructive/10">
                <CardContent className="space-y-4 p-6">
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
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => navigate("/")}
                      className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Go Home
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {isLoading && !displaySwapData && (
              <div className="flex items-center justify-center py-12">
                <div className="border-muted border-t-foreground h-16 w-16 animate-spin rounded-full border-4" />
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
                      unifiedAddress={`bitcoin:?arkade=${displaySwapData.htlc_address_arkade}&lightning=${displaySwapData.ln_invoice}&amount=${displaySwapData.sats_required / 100_000_000}`}
                      swapData={displaySwapData as BtcToPolygonSwapResponse}
                      usdcAmount={displaySwapData.usd_amount.toFixed(2)}
                      tokenSymbol={getTokenSymbol(displaySwapData.target_token)}
                    />
                  )}

                {currentStep === "user-deposit" &&
                  swapDirection === "polygon-to-btc" && (
                    <PolygonDepositStep
                      swapData={displaySwapData as PolygonToBtcSwapResponse}
                    />
                  )}

                {currentStep === "server-deposit" && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Processing Swap</h3>
                    <p className="text-muted-foreground">
                      Please wait while we confirm your deposit and process the
                      swap...
                    </p>
                    <div className="flex items-center justify-center py-12">
                      <div className="border-muted border-t-primary h-16 w-16 animate-spin rounded-full border-4" />
                    </div>
                  </div>
                )}

                {swapDirection && currentStep === "server-depositing" && (
                  <SwapProcessingStep
                    swapData={displaySwapData}
                    swapDirection={swapDirection}
                  />
                )}

                {currentStep === "success" && swapDirection && (
                  <SuccessStep
                    swapData={displaySwapData}
                    swapDirection={swapDirection}
                  />
                )}

                {currentStep === "expired" && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-destructive">
                      Swap Expired
                    </h3>
                    <p className="text-muted-foreground">
                      This swap has expired. The time window to complete the
                      swap has passed.
                    </p>
                  </div>
                )}

                {currentStep === "refundable" && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-orange-500">
                      Refund Available
                    </h3>
                    <p className="text-muted-foreground">
                      Your deposit can be refunded. Please contact support or
                      use the refund function.
                    </p>
                  </div>
                )}

                {currentStep === "refunded" && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Swap Refunded</h3>
                    <p className="text-muted-foreground">
                      Your funds have been refunded successfully.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Wizard Steps Navigation at Bottom */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <WizardSteps steps={steps} />
        </div>
      </div>
    </div>
  );
}
