import { useState, useEffect } from "react";
import { useParams } from "react-router";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "#/components/ui/card";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Loader2 } from "lucide-react";
import {
  initBrowserWallet,
  refundVhtlc,
  getAmountsForSwap,
  type VhtlcAmounts,
} from "@frontend/browser-wallet";

const ARK_SERVER_URL =
  import.meta.env.VITE_ARKADE_URL || "https://arkade.computer";

interface SwapData {
  secret: string;
  own_sk: string;
  lendaswap_pk: string;
  arkade_server_pk: string;
  refund_locktime: number;
  unilateral_claim_delay: number;
  unilateral_refund_delay: number;
  unilateral_refund_without_receiver_delay: number;
  network: string;
  vhtlc_address: string;
}

export function ManageSwapPage() {
  const { swapId } = useParams<{ swapId: string }>();
  const [swapData, setSwapData] = useState<SwapData | null>(null);
  const [wasmInitialized, setWasmInitialized] = useState(false);
  const [refundAddress, setRefundAddress] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<VhtlcAmounts | null>(null);
  const [isLoadingAmounts, setIsLoadingAmounts] = useState(false);

  // Initialize WASM module on mount
  useEffect(() => {
    initBrowserWallet()
      .then(() => {
        console.log("Browser wallet WASM initialized");
        setWasmInitialized(true);
      })
      .catch((error) => {
        console.error("Failed to initialize browser wallet:", error);
        setRefundError("Failed to initialize wallet module");
      });
  }, []);

  // Load swap data from localStorage
  useEffect(() => {
    if (!swapId) return;

    try {
      const data = localStorage.getItem(swapId);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.own_sk && parsed.vhtlc_address) {
          setSwapData(parsed);
        } else {
          setRefundError("Invalid swap data format");
        }
      } else {
        setRefundError("Swap not found in local storage");
      }
    } catch (error) {
      console.error("Failed to load swap data:", error);
      setRefundError("Failed to load swap data");
    }
  }, [swapId]);

  // Fetch amounts once WASM is initialized and swap data is loaded
  useEffect(() => {
    if (!wasmInitialized || !swapId || !swapData || amounts !== null) return;

    const fetchAmounts = async () => {
      setIsLoadingAmounts(true);
      try {
        const fetchedAmounts = await getAmountsForSwap(ARK_SERVER_URL, swapId);
        setAmounts(fetchedAmounts);
      } catch (error) {
        console.error("Failed to fetch amounts:", error);
        setRefundError(
          `Failed to fetch amounts: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsLoadingAmounts(false);
      }
    };

    fetchAmounts();
  }, [wasmInitialized, swapId, swapData, amounts]);

  // Calculate if swap can be refunded based on spendable amount and locktime
  const canRefund = (() => {
    if (!swapData || amounts === null) return false;

    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const hasSpendableAmount = amounts.spendable > 0;
    const isLocktimePassed = now >= swapData.refund_locktime;

    return hasSpendableAmount && isLocktimePassed;
  })();

  const refundLocktimeDate = swapData
    ? new Date(swapData.refund_locktime * 1000)
    : null;
  const isLocktimePassed = swapData
    ? Math.floor(Date.now() / 1000) >= swapData.refund_locktime
    : false;

  const handleRefund = async () => {
    if (!swapId || !refundAddress.trim()) {
      setRefundError("Please enter a refund address");
      return;
    }

    if (!wasmInitialized) {
      setRefundError("Wallet module not initialized yet. Please wait.");
      return;
    }

    setIsRefunding(true);
    setRefundError(null);
    setRefundSuccess(null);

    try {
      const txid = await refundVhtlc(ARK_SERVER_URL, swapId, refundAddress);
      setRefundSuccess(`Refund successful! Transaction ID: ${txid}`);
    } catch (error) {
      console.error("Refund failed:", error);
      setRefundError(
        error instanceof Error
          ? error.message
          : "Failed to refund swap. Check the logs or try again later.",
      );
    } finally {
      setIsRefunding(false);
    }
  };

  if (!swapData) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>
                {refundError || "Loading swap data..."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Swap ID</CardTitle>
          <CardDescription>
            <div className="space-y-1">
              <p className="text-m text-muted-foreground font-mono">{swapId}</p>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!wasmInitialized && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Initializing wallet module...
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">VHTLC Address</p>
              <p className="text-xs text-muted-foreground font-mono break-all">
                {swapData.vhtlc_address}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">VHTLC Amounts</p>
              {isLoadingAmounts ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <p className="text-xs text-muted-foreground">Loading...</p>
                </div>
              ) : amounts !== null ? (
                <div className="space-y-1">
                  {amounts.spendable > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Spendable: {amounts.spendable.toLocaleString()} sats
                    </p>
                  )}
                  {amounts.spent > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Spent: {amounts.spent.toLocaleString()} sats
                    </p>
                  )}
                  {amounts.recoverable > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Recoverable: {amounts.recoverable.toLocaleString()} sats
                    </p>
                  )}
                  {amounts.spendable === 0 &&
                    amounts.spent === 0 &&
                    amounts.recoverable === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Not yet funded
                      </p>
                    )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Unknown</p>
              )}
            </div>

            {amounts && amounts?.spendable > 0 && (
              <div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Refund Locktime</p>
                  <p className="text-xs text-muted-foreground">
                    {refundLocktimeDate
                      ? refundLocktimeDate.toLocaleString()
                      : "Unknown"}
                    {refundLocktimeDate && (
                      <span
                        className={`ml-2 ${isLocktimePassed ? "text-green-600" : "text-orange-600"}`}
                      >
                        ({isLocktimePassed ? "Passed" : "Not yet reached"})
                      </span>
                    )}
                  </p>
                </div>

                {!canRefund && amounts !== null && (
                  <Alert>
                    <AlertDescription>
                      {amounts.spendable === 0
                        ? "No spendable funds available for this swap."
                        : !isLocktimePassed
                          ? "The refund locktime has not been reached yet. Please wait until the locktime passes."
                          : "This swap cannot be refunded at this time."}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {canRefund && (
            <div className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="refundAddress">
                  Refund Address (Arkade Address)
                </Label>
                <Input
                  id="refundAddress"
                  type="text"
                  placeholder="ark1..."
                  value={refundAddress}
                  onChange={(e) => setRefundAddress(e.target.value)}
                  disabled={isRefunding}
                />
              </div>

              <Button
                onClick={handleRefund}
                disabled={
                  !wasmInitialized ||
                  isRefunding ||
                  !refundAddress.trim() ||
                  !canRefund
                }
                className="w-full"
              >
                {isRefunding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refunding...
                  </>
                ) : (
                  "Refund This Swap"
                )}
              </Button>
            </div>
          )}

          {refundError && (
            <Alert variant="destructive">
              <AlertDescription>{refundError}</AlertDescription>
            </Alert>
          )}

          {refundSuccess && (
            <Alert>
              <AlertDescription>{refundSuccess}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
