import { useLocation, useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
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
    <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950 rounded-2xl">
      <CardContent className="py-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              Debug Mode Active
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!isWizardPage ? "default" : "outline"}
              onClick={() => navigate("/")}
            >
              Enter Amount
            </Button>
            <Button
              size="sm"
              variant={currentStep === "pending" ? "default" : "outline"}
              onClick={() => navigate(`/swap/${DEBUG_SWAP_ID}/wizard?step=pending`)}
            >
              Send Bitcoin
            </Button>
            <Button
              size="sm"
              variant={currentStep === "clientfunded" ? "default" : "outline"}
              onClick={() => navigate(`/swap/${DEBUG_SWAP_ID}/wizard?step=clientfunded`)}
            >
              Processing
            </Button>
            <Button
              size="sm"
              variant={currentStep === "serverredeemed" ? "default" : "outline"}
              onClick={() => navigate(`/swap/${DEBUG_SWAP_ID}/wizard?step=serverredeemed`)}
            >
              Success
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
