import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { GetSwapResponse } from "../../api";
import { useState } from "react";

interface ConfirmingDepositStepProps {
  swapData: GetSwapResponse;
  swapDirection: "btc-to-polygon" | "polygon-to-btc";
}

export function SwapProcessingStep({
  swapData,
  swapDirection,
}: ConfirmingDepositStepProps) {
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

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
            <Check className="h-4 w-4 text-primary-foreground" />
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
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                {config.step1IsPolygon && (
                  <a
                    href={`https://polygonscan.com/tx/${config.step1TxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
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
              <Check className="h-4 w-4 text-primary-foreground" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                {config.step2IsPolygon && (
                  <a
                    href={`https://polygonscan.com/tx/${config.step2TxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
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
              <Check className="h-4 w-4 text-primary-foreground" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                {config.step3IsPolygon && (
                  <a
                    href={`https://polygonscan.com/tx/${config.step3TxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
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
              <Check className="h-4 w-4 text-primary-foreground" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                {config.step4IsPolygon && (
                  <a
                    href={`https://polygonscan.com/tx/${config.step4TxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
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
