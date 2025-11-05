import { Check, Copy, Loader2 } from "lucide-react";
import { GetSwapResponse } from "../../api";
import { useState } from "react";

interface ConfirmingDepositStepProps {
  swapData: GetSwapResponse;
  swapDirection: "btc-to-polygon" | "polygon-to-btc";
}

export function ConfirmingDepositStep({
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

  if (swapDirection === "btc-to-polygon") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Processing Swap</h3>
          <p className="text-muted-foreground">
            Your swap is being processed. Please wait...
          </p>
        </div>

        <div className="space-y-4">
          {/* Step 1: User Funded */}
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
              <Check className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">User Funded</p>
              {swapData.bitcoin_htlc_fund_txid && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(swapData.bitcoin_htlc_fund_txid)}
                  </code>
                  <button
                    onClick={() =>
                      handleCopyTxId(swapData.bitcoin_htlc_fund_txid!)
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === swapData.bitcoin_htlc_fund_txid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Server Funding/Funded */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                swapData.polygon_htlc_fund_txid ? "bg-primary" : "bg-muted"
              }`}
            >
              {swapData.polygon_htlc_fund_txid ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">
                {swapData.polygon_htlc_fund_txid
                  ? "Server Funded"
                  : "Server Funding"}
              </p>
              {swapData.polygon_htlc_fund_txid && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(swapData.polygon_htlc_fund_txid)}
                  </code>
                  <button
                    onClick={() =>
                      handleCopyTxId(swapData.polygon_htlc_fund_txid!)
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === swapData.polygon_htlc_fund_txid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Client Redeeming */}
          <div className="flex items-start gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                swapData.polygon_htlc_claim_txid ? "bg-primary" : "bg-muted"
              }`}
            >
              {swapData.polygon_htlc_claim_txid ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium">Client Redeeming</p>
              {swapData.polygon_htlc_claim_txid && (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(swapData.polygon_htlc_claim_txid)}
                  </code>
                  <button
                    onClick={() =>
                      handleCopyTxId(swapData.polygon_htlc_claim_txid!)
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === swapData.polygon_htlc_claim_txid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Server Redeemed (optional, only shown if exists) */}
          {swapData.bitcoin_htlc_claim_txid && (
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary">
                <Check className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-medium">Server Redeemed</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-muted-foreground">
                    {clipTxId(swapData.bitcoin_htlc_claim_txid)}
                  </code>
                  <button
                    onClick={() =>
                      handleCopyTxId(swapData.bitcoin_htlc_claim_txid!)
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedTxId === swapData.bitcoin_htlc_claim_txid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // polygon-to-btc
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Confirming Deposit</h3>
      <p className="text-muted-foreground">
        Your Polygon deposit has been received. Waiting for confirmations...
      </p>
      <div className="flex items-center justify-center py-12">
        <div className="border-muted border-t-primary h-16 w-16 animate-spin rounded-full border-4" />
      </div>
    </div>
  );
}
