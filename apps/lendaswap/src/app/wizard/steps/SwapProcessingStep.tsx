import {Check, Copy, ExternalLink, Loader2} from "lucide-react";
import {api, GetSwapResponse} from "../../api";
import {useEffect, useRef, useState} from "react";
import {
  claimVhtlc,
  getAmountsForSwap,
  initBrowserWallet,
} from "@frontend/browser-wallet";

const ARK_SERVER_URL =
  import.meta.env.VITE_ARK_SERVER_URL || "https://arkade.lendasat.com";

interface ConfirmingDepositStepProps {
  swapData: GetSwapResponse;
  swapDirection: "btc-to-polygon" | "polygon-to-btc";
}

export function SwapProcessingStep({
                                     swapData,
                                     swapDirection,
                                   }: ConfirmingDepositStepProps) {
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const hasClaimedRef = useRef(false);
  const [wasmInitialized, setWasmInitialized] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  // Load secret from localStorage
  useEffect(() => {
    const swapData_local = localStorage.getItem(swapData.id);
    console.log("Loading secret from localStorage for swapId:", swapData.id);
    console.log("LocalStorage data:", swapData_local);

    if (swapData_local) {
      try {
        const parsed = JSON.parse(swapData_local);
        console.log("Parsed swap data:", parsed);
        setSecret(parsed.secret || null);
        console.log("Secret set to:", parsed.secret || null);
      } catch (error) {
        console.error("Failed to parse swap data from localStorage:", error);
      }
    } else {
      console.warn(
        "No swap data found in localStorage for swapId:",
        swapData.id,
      );
    }
  }, [swapData.id]);

  // Initialize WASM module on mount
  useEffect(() => {
    initBrowserWallet()
      .then(() => {
        console.log("Browser wallet WASM initialized");
        setWasmInitialized(true);
      })
      .catch((error) => {
        console.error("Failed to initialize browser wallet:", error);
      });
  }, []);

  // Auto-claim for btc-to-polygon when server is funded
  useEffect(() => {
    const autoClaimBtcToPolygonSwaps = async () => {
      if (swapDirection !== "btc-to-polygon") return;
      if (swapData.status !== "serverfunded") return;
      if (!secret) return;

      const claimKey = `swap_${swapData.id}_claim_attempted`;
      if (localStorage.getItem(claimKey)) {
        console.log("Claim already attempted for this swap, skipping");
        return;
      }

      if (hasClaimedRef.current || isClaiming) return;

      hasClaimedRef.current = true;
      setIsClaiming(true);
      setClaimError(null);

      try {
        const cleanSecret = secret.startsWith("0x") ? secret.slice(2) : secret;

        console.log("Auto-claiming with parameters:", {
          swapId: swapData.id,
          secret: cleanSecret,
        });

        // Mark that we've attempted to claim BEFORE making the API call
        localStorage.setItem(claimKey, Date.now().toString());

        await api.claimGelato(swapData.id, cleanSecret);

        console.log("Claim request sent successfully");
      } catch (error) {
        console.error("Failed to auto-claim:", error);
        setClaimError(
          error instanceof Error
            ? error.message
            : `Failed to claim tokens. Check the logs or try again later.`,
        );
        // Remove the localStorage flag on error to allow retry
        localStorage.removeItem(claimKey);
        hasClaimedRef.current = false;
      } finally {
        setIsClaiming(false);
      }
    };

    autoClaimBtcToPolygonSwaps();
  }, [swapData, swapDirection, secret, isClaiming]);

  // Auto-claim for polygon-to-btc when server is funded
  useEffect(() => {
    const autoClaimPolygonToArkadeSwaps = async () => {
      if (swapDirection !== "polygon-to-btc") return;
      if (swapData.status !== "serverfunded") return;
      if (!wasmInitialized) return;
      if (!swapData.user_address_arkade) {
        console.error("No user address for arkade provided");
        setClaimError("Missing Arkade address for claim");
        return;
      }

      const claimKey = `swap_${swapData.id}_claim_attempted`;
      if (localStorage.getItem(claimKey)) {
        console.log("Claim already attempted for this swap, skipping");
        return;
      }

      if (hasClaimedRef.current || isClaiming) return;

      hasClaimedRef.current = true;
      setIsClaiming(true);
      setClaimError(null);

      try {
        const fetchedAmounts = await getAmountsForSwap(
          ARK_SERVER_URL,
          swapData.id,
        );
        console.log(`Fetched amounts for swap`, fetchedAmounts);

        console.log("Auto-claiming with parameters:", {swapId: swapData.id});

        // Mark that we've attempted to claim BEFORE making the API call
        localStorage.setItem(claimKey, Date.now().toString());

        const txid = await claimVhtlc(
          ARK_SERVER_URL,
          swapData.id,
          swapData.user_address_arkade,
        );
        console.log(`Claim request sent successfully ${txid}`);
      } catch (error) {
        console.error("Failed to auto-claim:", error);
        setClaimError(
          error instanceof Error
            ? error.message
            : `Failed to claim sats. Check the logs or try again later.`,
        );
        // Remove the localStorage flag on error to allow retry
        localStorage.removeItem(claimKey);
        hasClaimedRef.current = false;
      } finally {
        setIsClaiming(false);
      }
    };

    autoClaimPolygonToArkadeSwaps();
  }, [swapData, swapDirection, wasmInitialized, isClaiming]);

  const handleCopyTxId = async (txId: string) => {
    try {
      await navigator.clipboard.writeText(txId);
      setCopiedTxId(txId);
      setTimeout(() => setCopiedTxId(null), 2000);
    } catch (err) {
      console.error("Failed to copy transaction ID:", err);
    }
  };

  const clipTxId = (txId: string) => {
    return `${txId.slice(0, 8)}...${txId.slice(-8)}`;
  };

  // Define field mappings and labels based on swap direction
  const config =
    swapDirection === "btc-to-polygon"
      ? {
        step1Label: "User Funded",
        step1TxId: swapData.bitcoin_htlc_fund_txid,
        step1IsPolygon: false,
        step2LabelActive: "Server Funding",
        step2LabelComplete: "Server Funded",
        step2TxId: swapData.polygon_htlc_fund_txid,
        step2IsPolygon: true,
        step3Label: "Client Redeeming",
        step3TxId: swapData.polygon_htlc_claim_txid,
        step3IsPolygon: true,
        step4Label: "Server Redeemed",
        step4TxId: swapData.bitcoin_htlc_claim_txid,
        step4IsPolygon: false,
      }
      : {
        step1Label: "User Funded",
        step1TxId: swapData.polygon_htlc_fund_txid,
        step1IsPolygon: true,
        step2LabelActive: "Server Funding",
        step2LabelComplete: "Server Funded",
        step2TxId: swapData.bitcoin_htlc_fund_txid,
        step2IsPolygon: false,
        step3Label: "Client Redeeming",
        step3TxId: swapData.bitcoin_htlc_claim_txid,
        step3IsPolygon: false,
        step4Label: "Server Redeemed",
        step4TxId: swapData.polygon_htlc_claim_txid,
        step4IsPolygon: true,
      };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Step 1: User Funded */}
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
            <Check className="h-4 w-4 text-primary-foreground"/>
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-medium">{config.step1Label}</p>
            {config.step1TxId && (
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground">
                  {clipTxId(config.step1TxId)}
                </code>
                <button
                  onClick={() => handleCopyTxId(config.step1TxId!)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copiedTxId === config.step1TxId ? (
                    <Check className="h-3 w-3"/>
                  ) : (
                    <Copy className="h-3 w-3"/>
                  )}
                </button>
                {config.step1IsPolygon && (
                  <a
                    href={`https://polygonscan.com/tx/${config.step1TxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3"/>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Server Funding/Funded */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              config.step2TxId ? "bg-primary" : "bg-muted"
            }`}
          >
            {config.step2TxId ? (
              <Check className="h-4 w-4 text-primary-foreground"/>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-medium">
              {config.step2TxId
                ? config.step2LabelComplete
                : config.step2LabelActive}
            </p>
            {config.step2TxId && (
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground">
                  {clipTxId(config.step2TxId)}
                </code>
                <button
                  onClick={() => handleCopyTxId(config.step2TxId!)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copiedTxId === config.step2TxId ? (
                    <Check className="h-3 w-3"/>
                  ) : (
                    <Copy className="h-3 w-3"/>
                  )}
                </button>
                {config.step2IsPolygon && (
                  <a
                    href={`https://polygonscan.com/tx/${config.step2TxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3"/>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Client Redeeming */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              config.step3TxId ? "bg-primary" : "bg-muted"
            }`}
          >
            {config.step3TxId ? (
              <Check className="h-4 w-4 text-primary-foreground"/>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-medium">{config.step3Label}</p>
            {config.step3TxId && (
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground">
                  {clipTxId(config.step3TxId)}
                </code>
                <button
                  onClick={() => handleCopyTxId(config.step3TxId!)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copiedTxId === config.step3TxId ? (
                    <Check className="h-3 w-3"/>
                  ) : (
                    <Copy className="h-3 w-3"/>
                  )}
                </button>
                {config.step3IsPolygon && (
                  <a
                    href={`https://polygonscan.com/tx/${config.step3TxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3"/>
                  </a>
                )}
              </div>
            )}
            {/* Show claiming status inline when server is funded */}
            {swapData.status === "serverfunded" && (
              <div className="from-primary/5 to-card mt-2 space-y-2 rounded-lg border bg-gradient-to-t p-4">
                <p className="text-sm font-medium">
                  {isClaiming
                    ? swapDirection === "polygon-to-btc"
                      ? "Redeeming your sats..."
                      : "Claiming your tokens..."
                    : swapDirection === "polygon-to-btc"
                      ? "VHTLC Funded"
                      : "HTLC Funded"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {isClaiming
                    ? swapDirection === "polygon-to-btc"
                      ? "Claiming the Bitcoin VHTLC and publishing the transaction..."
                      : "Submitting claim request via Gelato Relay..."
                    : swapDirection === "polygon-to-btc"
                      ? "The VHTLC has been funded. Preparing to claim your sats..."
                      : "The HTLC has been funded. Preparing to claim your tokens..."}
                </p>
                {swapDirection === "btc-to-polygon" && !isClaiming && (
                  <p className="text-muted-foreground text-xs">
                    Gas fees fully sponsored via Gelato Relay - no fees for you!
                  </p>
                )}
                {claimError && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-2 text-xs">
                    {claimError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 4: Server Redeemed */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              config.step4TxId ? "bg-primary" : "bg-muted"
            }`}
          >
            {config.step4TxId ? (
              <Check className="h-4 w-4 text-primary-foreground"/>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-medium">{config.step4Label}</p>
            {config.step4TxId && (
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground">
                  {clipTxId(config.step4TxId)}
                </code>
                <button
                  onClick={() => handleCopyTxId(config.step4TxId!)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copiedTxId === config.step4TxId ? (
                    <Check className="h-3 w-3"/>
                  ) : (
                    <Copy className="h-3 w-3"/>
                  )}
                </button>
                {config.step4IsPolygon && (
                  <a
                    href={`https://polygonscan.com/tx/${config.step4TxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3"/>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
