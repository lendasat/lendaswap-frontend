import { useLocation, useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import { DEBUG_SWAP_ID, isDebugMode } from "../utils/debugMode";

export function DebugNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isDebugMode()) {
    return null;
  }

  const currentStep = new URLSearchParams(location.search).get("step");
  const isWizardPage = location.pathname.includes(`/swap/${DEBUG_SWAP_ID}/wizard`);

  return (
    <div className="mb-6 flex flex-col items-center gap-3 border-t border-orange-500/30 bg-orange-500/5 px-4 py-3 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
        <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
          Debug Mode
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          size="sm"
          variant={!isWizardPage ? "default" : "outline"}
          onClick={() => navigate("/")}
          className="h-8 text-xs"
        >
          Enter Amount
        </Button>
        <Button
          size="sm"
          variant={currentStep === "pending" ? "default" : "outline"}
          onClick={() => navigate(`/swap/${DEBUG_SWAP_ID}/wizard?step=pending`)}
          className="h-8 text-xs"
        >
          Send Bitcoin
        </Button>
        <Button
          size="sm"
          variant={currentStep === "clientfunded" ? "default" : "outline"}
          onClick={() => navigate(`/swap/${DEBUG_SWAP_ID}/wizard?step=clientfunded`)}
          className="h-8 text-xs"
        >
          Processing
        </Button>
        <Button
          size="sm"
          variant={currentStep === "serverredeemed" ? "default" : "outline"}
          onClick={() => navigate(`/swap/${DEBUG_SWAP_ID}/wizard?step=serverredeemed`)}
          className="h-8 text-xs"
        >
          Success
        </Button>
      </div>
    </div>
  );
}
