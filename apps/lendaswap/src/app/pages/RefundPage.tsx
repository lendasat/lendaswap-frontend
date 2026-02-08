import { isBtc, isEvmToken } from "@lendasat/lendaswap-sdk-pure";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Alert, AlertDescription } from "#/components/ui/alert";
import type {
  ArkadeToEvmSwapResponse,
  BtcToEvmSwapResponse,
  EvmToArkadeSwapResponse,
  EvmToBtcSwapResponse,
} from "../api";
import { getSwapById, type StoredSwap } from "../db";
import { useWalletBridge } from "../WalletBridgeContext";
import {
  BtcToPolygonRefundStep,
  PolygonToBtcRefundStep,
  RefundArkadeStep,
  RefundEvmStep,
} from "../wizard/steps";

export function RefundPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const navigate = useNavigate();
  const { arkAddress } = useWalletBridge();
  const [swapData, setSwapData] = useState<StoredSwap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Refund Swap | LendaSwap";
  }, []);

  // Load swap data from Dexie
  useEffect(() => {
    if (!swapId) {
      setError("No swap ID provided");
      setIsLoading(false);
      return;
    }

    const loadSwap = async () => {
      try {
        console.log("Loading swap from database:", swapId);
        const swap = await getSwapById(swapId);

        if (!swap) {
          setError("Swap not found in database");
          setIsLoading(false);
          return;
        }

        console.log("Swap data loaded:", swap);
        setSwapData(swap);
      } catch (err) {
        console.error("Failed to load swap:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load swap data",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSwap();
  }, [swapId]);

  // Determine swap direction - check direction field first, then fall back to token checks
  const swapDirection =
    swapData && "direction" in swapData
      ? (swapData as { direction?: string }).direction
      : undefined;
  const isArkadeToEvmSwap = swapDirection === "arkade_to_evm";
  const isEvmToArkadeSwap = swapDirection === "evm_to_arkade";
  const isBtcToEvmSwap =
    !isArkadeToEvmSwap && !isEvmToArkadeSwap && swapData
      ? isBtc(swapData.source_token)
      : false;
  const isEvmToBtcSwap =
    !isArkadeToEvmSwap && !isEvmToArkadeSwap && swapData
      ? isEvmToken(swapData.source_token)
      : false;

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-muted-foreground">Loading swap data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !swapData || !swapId) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
          <div className="space-y-4 px-6 py-6 bg-destructive/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <h3 className="text-xl font-semibold">Error Loading Swap</h3>
            </div>
            <p className="text-muted-foreground">
              {error || "Could not load swap data"}
            </p>
            {swapId && (
              <p className="text-xs text-muted-foreground font-mono">
                Swap ID: {swapId}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go Home
              </button>
              <button
                type="button"
                onClick={() => navigate("/swaps")}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                View All Swaps
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      {isBtcToEvmSwap && (
        <BtcToPolygonRefundStep
          swapData={swapData as unknown as BtcToEvmSwapResponse}
          swapId={swapId}
          arkAddress={arkAddress}
        />
      )}

      {isEvmToBtcSwap && (
        <PolygonToBtcRefundStep
          swapData={swapData as unknown as EvmToBtcSwapResponse}
          swapId={swapId}
        />
      )}

      {isArkadeToEvmSwap && (
        <RefundArkadeStep
          swapData={swapData as unknown as ArkadeToEvmSwapResponse}
          swapId={swapId}
          arkAddress={arkAddress}
        />
      )}

      {isEvmToArkadeSwap && (
        <RefundEvmStep
          swapData={swapData as unknown as EvmToArkadeSwapResponse}
          swapId={swapId}
        />
      )}

      {!isEvmToBtcSwap &&
        !isBtcToEvmSwap &&
        !isArkadeToEvmSwap &&
        !isEvmToArkadeSwap && (
          <Alert variant="destructive">
            <AlertDescription>
              Unknown swap direction. Cannot display refund interface.
            </AlertDescription>
          </Alert>
        )}
    </div>
  );
}
