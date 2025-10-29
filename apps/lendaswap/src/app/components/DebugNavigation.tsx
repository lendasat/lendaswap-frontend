import { useNavigate, useLocation } from "react-router";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { isDebugMode, DEBUG_SWAP_ID } from "../utils/debugMode";

export function DebugNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isDebugMode()) {
    return null;
  }

  return (
    <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
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
              variant={location.pathname === "/" ? "default" : "outline"}
              onClick={() => navigate("/")}
            >
              Enter Amount
            </Button>
            <Button
              size="sm"
              variant={
                location.pathname.includes("/send") ? "default" : "outline"
              }
              onClick={() => navigate(`/swap/${DEBUG_SWAP_ID}/send`)}
            >
              Send Bitcoin
            </Button>
            <Button
              size="sm"
              variant={
                location.pathname.includes("/processing")
                  ? "default"
                  : "outline"
              }
              onClick={() => navigate(`/swap/${DEBUG_SWAP_ID}/processing`)}
            >
              Processing
            </Button>
            <Button
              size="sm"
              variant={
                location.pathname.includes("/success") ? "default" : "outline"
              }
              onClick={() => navigate(`/swap/${DEBUG_SWAP_ID}/success`)}
            >
              Success
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
