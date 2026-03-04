import { toChainName } from "@lendasat/lendaswap-sdk-pure";
import {
  ArrowRight,
  CheckCheck,
  Copy,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import type { GetSwapResponse } from "../../api";
import {
  getBlockexplorerAddressLink,
  getBlockexplorerTxLink,
  getTokenIcon,
  getTokenNetworkIcon,
} from "../../utils/tokenUtils";

interface RefundedStepProps {
  swapData: GetSwapResponse;
}

export function RefundedStep({ swapData }: RefundedStepProps) {
  const navigate = useNavigate();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const sourceSymbol = swapData.source_token.symbol;
  const targetSymbol = swapData.target_token.symbol;
  const sourceNetwork = toChainName(swapData.source_token.chain);

  const formatAmount = (amount: number | string, decimals: number): string => {
    const value = Number(amount) / 10 ** decimals;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  const sourceAmount = formatAmount(
    swapData.source_amount,
    swapData.source_token.decimals,
  );

  // Get the refund-relevant address (where the user funded from / where refund goes)
  const getRefundAddress = (): string | null => {
    switch (swapData.direction) {
      case "arkade_to_evm":
        return swapData.btc_vhtlc_address ?? null;
      case "evm_to_arkade":
      case "evm_to_bitcoin":
      case "evm_to_lightning":
        return swapData.evm_htlc_address ?? null;
      case "btc_to_arkade":
      case "bitcoin_to_evm":
        return swapData.btc_htlc_address ?? null;
      case "lightning_to_evm":
        return null; // Lightning refunds go back via the LN channel
      default:
        return null;
    }
  };

  // Get the spend (claim/refund) transaction ID on the source side
  const getRefundTxId = (): string | null => {
    switch (swapData.direction) {
      case "arkade_to_evm":
        return swapData.btc_claim_txid ?? null;
      case "evm_to_arkade":
      case "evm_to_bitcoin":
      case "evm_to_lightning":
        return swapData.evm_claim_txid ?? null;
      case "btc_to_arkade":
        return swapData.btc_claim_txid ?? null;
      case "bitcoin_to_evm":
        return swapData.btc_claim_txid ?? null;
      case "lightning_to_evm":
        return null;
    }
  };

  // Chain for block explorer links (source chain, since refund goes back to source)
  const sourceChain = swapData.source_token.chain;

  const refundAddress = getRefundAddress();
  const refundTxId = getRefundTxId();

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Source token */}
          <div className="relative">
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-muted border border-border">
              <div className="w-5 h-5 flex items-center justify-center">
                {getTokenIcon(swapData.source_token)}
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background p-[1px] flex items-center justify-center">
              <div className="w-full h-full rounded-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full">
                {getTokenNetworkIcon(swapData.source_token)}
              </div>
            </div>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          {/* Target token */}
          <div className="relative">
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-muted border border-border">
              <div className="w-5 h-5 flex items-center justify-center">
                {getTokenIcon(swapData.target_token)}
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background p-[1px] flex items-center justify-center">
              <div className="w-full h-full rounded-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full">
                {getTokenNetworkIcon(swapData.target_token)}
              </div>
            </div>
          </div>
          <h3 className="text-sm font-semibold">
            {sourceSymbol} → {targetSymbol}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono text-muted-foreground">
            {swapData.id.slice(0, 8)}…
          </code>
          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex flex-col items-center space-y-6">
          {/* Refunded Icon */}
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
            <RotateCcw className="text-muted-foreground h-8 w-8" />
          </div>

          {/* Refunded Message */}
          <div className="space-y-2 text-center">
            <h3 className="text-2xl font-semibold">Swap Refunded</h3>
            <p className="text-muted-foreground text-sm">
              Your {sourceSymbol} has been refunded
            </p>
          </div>

          {/* Transaction Details */}
          <div className="bg-muted/50 w-full max-w-md space-y-3 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Refunded</span>
              <span className="font-medium">
                {sourceAmount} {sourceSymbol}
                {" on "}
                {sourceNetwork}
              </span>
            </div>
            {refundAddress && (
              <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
                <span className="text-muted-foreground">HTLC Address</span>
                <div className="flex items-center gap-2">
                  <a
                    href={
                      getBlockexplorerAddressLink(sourceChain, refundAddress) ??
                      "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 break-all font-mono text-xs hover:underline"
                  >
                    {refundAddress}
                  </a>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopyAddress(refundAddress)}
                      className="h-8 w-8"
                    >
                      {copiedAddress === refundAddress ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                      className="h-8 w-8"
                    >
                      <a
                        href={
                          getBlockexplorerAddressLink(
                            sourceChain,
                            refundAddress,
                          ) ?? "#"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {refundTxId && (
              <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
                <span className="text-muted-foreground">
                  Refund Transaction
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={
                      getBlockexplorerTxLink(sourceChain, refundTxId) ?? "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 break-all font-mono text-xs hover:underline"
                  >
                    {refundTxId}
                  </a>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopyAddress(refundTxId)}
                      className="h-8 w-8"
                    >
                      {copiedAddress === refundTxId ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                      className="h-8 w-8"
                    >
                      <a
                        href={
                          getBlockexplorerTxLink(sourceChain, refundTxId) ?? "#"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <Button
            className="h-12 w-full max-w-md text-base font-semibold"
            onClick={() => navigate("/", { replace: true })}
          >
            Start New Swap
          </Button>
        </div>
      </div>
    </div>
  );
}
