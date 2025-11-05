import { useNavigate, useParams } from "react-router";
import { Card, CardContent } from "#/components/ui/card";
import { api, TokenId } from "../api";
import { WizardSteps } from "./WizardSteps";
import { useAsync } from "react-use";

type SwapDirection = "btc-to-polygon" | "polygon-to-btc";

type StepId =
  | "user-deposit"
  | "server-deposit"
  | "user-redeem"
  | "server-redeem"
  | "success";

interface Step {
  id: StepId;
  label: string;
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

export function SwapWizardPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();

  const { loading: isLoading, value: swapData } = useAsync(async () => {
    if (!swapId) {
      navigate("/", { replace: true });
      return;
    }
    return await api.getSwap(swapId);
  });

  const swapDirection = isBtcToPolygon(swapData?.source_token);

  const currentStep = determineStepFromStatus(swapData?.status);

  // Determine step from swap status
  function determineStepFromStatus(
    status: undefined | string,
  ): StepId | undefined {
    if (!status) {
      return undefined;
    }

    switch (status) {
      case "pending":
        return "user-deposit";
      case "clientfunded":
      case "serverfunded":
        return "server-deposit";
      case "serverredeemed":
        return "success";
      case "clientredeemed":
        return "success";
      default:
        return "user-deposit";
    }
  }

  // Build steps based on swap direction
  const buildSteps = (): Step[] => {
    if (!swapDirection || !currentStep) return [];

    if (swapDirection === "btc-to-polygon") {
      return [
        {
          id: "user-deposit",
          label: "Waiting for deposit",
          status:
            currentStep === "user-deposit"
              ? "current"
              : ["server-deposit", "user-redeem", "success"].includes(
                    currentStep,
                  )
                ? "completed"
                : "upcoming",
        },
        {
          id: "server-deposit",
          label: "Confirming",
          status:
            currentStep === "server-deposit"
              ? "current"
              : ["user-redeem", "success"].includes(currentStep)
                ? "completed"
                : "upcoming",
        },
        {
          id: "user-redeem",
          label: "Exchanging",
          status:
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
        status:
          currentStep === "user-deposit"
            ? "current"
            : ["server-deposit", "user-redeem", "success"].includes(currentStep)
              ? "completed"
              : "upcoming",
      },
      {
        id: "server-deposit",
        label: "Confirming",
        status:
          currentStep === "server-deposit"
            ? "current"
            : ["user-redeem", "success"].includes(currentStep)
              ? "completed"
              : "upcoming",
      },
      {
        id: "user-redeem",
        label: "Exchanging",
        status:
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

  if (isLoading || !swapData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="border-muted border-t-foreground h-16 w-16 animate-spin rounded-full border-4" />
      </div>
    );
  }

  const steps = buildSteps();

  return (
    <div className="space-y-6">
      {/* Wizard Steps Navigation */}
      <WizardSteps steps={steps} />

      {/* Step Content Card */}
      <Card className="border-0 shadow-none">
        <CardContent className="space-y-6 p-0">
          {/* Step-specific content will go here */}
          {currentStep === "user-deposit" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">
                {swapDirection === "btc-to-polygon"
                  ? "Send Bitcoin"
                  : "Deposit on Polygon"}
              </h3>
              <p className="text-muted-foreground">
                {swapDirection === "btc-to-polygon"
                  ? "Scan the QR code or copy the address below to send Bitcoin"
                  : "Connect your wallet and approve the transaction"}
              </p>
              {/* Actual deposit UI will be integrated here */}
            </div>
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

          {currentStep === "success" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Swap Complete!</h3>
              <p className="text-muted-foreground">
                Your swap has been completed successfully.
              </p>
              {/* Success UI will be integrated here */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
