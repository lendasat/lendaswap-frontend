import {
  type CctpChainName,
  type CctpMessageStatus,
  toChain,
  trackCctpMessage,
} from "@lendasat/lendaswap-sdk-pure";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { GetSwapResponse } from "../../../api";
import {
  getBridgeInfo,
  getDirectionConfig,
  getSwapDisplayInfo,
} from "./config";
import {
  AddressRow,
  AmountRow,
  CrossChainStatusRow,
  TxHashRow,
} from "./DetailRows";
import { SuccessLayout } from "./SuccessLayout";

export function CctpDetails({ swapData }: { swapData: GetSwapResponse }) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const config = getDirectionConfig(swapData);
  const { sourceSymbol, targetSymbol, sourceNetwork, targetNetwork } =
    getSwapDisplayInfo(swapData);
  const bridgeInfo = getBridgeInfo(swapData);
  const bridgeTxHash = bridgeInfo.claimTxHash;

  // CCTP tracking state
  const [cctpStatus, setCctpStatus] = useState<CctpMessageStatus | null>(null);
  const [forwardTxHash, setForwardTxHash] = useState<string | null>(null);
  const [cctpAmount, setCctpAmount] = useState<string | null>(null);
  const [cctpFee, setCctpFee] = useState<string | null>(null);
  const [cctpError, setCctpError] = useState<string | null>(null);

  useEffect(() => {
    if (!bridgeTxHash || !bridgeInfo.sourceChainName) return;
    let cancelled = false;

    trackCctpMessage({
      sourceChain: bridgeInfo.sourceChainName as CctpChainName,
      txHash: bridgeTxHash,
      pollIntervalMs: 5_000,
      timeoutMs: 600_000,
      onStatusChange: (status) => {
        if (!cancelled) setCctpStatus(status);
      },
    })
      .then((result) => {
        if (!cancelled) {
          setCctpStatus("COMPLETE");
          setForwardTxHash(result.forwardTxHash ?? null);
          setCctpAmount(result.amount ?? null);
          setCctpFee(result.feeExecuted ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) setCctpError(String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [bridgeTxHash, bridgeInfo.sourceChainName]);

  // Derive cross-chain status for the shared component
  const bridgeStatusKind: "pending" | "complete" | "error" = cctpError
    ? "error"
    : cctpStatus === "COMPLETE"
      ? "complete"
      : "pending";

  const statusText =
    cctpStatus === "CONFIRMING"
      ? "Confirming..."
      : cctpStatus === "FORWARDING"
        ? `Forwarding to ${targetNetwork}...`
        : `Bridging to ${targetNetwork}...`;

  const description =
    cctpStatus === "COMPLETE" ? (
      <>
        Arrived on {targetNetwork}.
        {cctpAmount && (
          <>
            {" "}
            Received{" "}
            {(Number(cctpAmount) / 1e6).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}{" "}
            {targetSymbol}
            {cctpFee &&
              ` (fee: ${(Number(cctpFee) / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${targetSymbol})`}
          </>
        )}
      </>
    ) : cctpError ? (
      <>
        Tracking failed. Your funds are safe — CCTP will deliver them to{" "}
        {targetNetwork} automatically.
      </>
    ) : (
      <>
        Bridging from {bridgeInfo.sourceChainName} to {targetNetwork} via CCTP.
        Usually 1-2 min.
      </>
    );

  return (
    <SuccessLayout
      swapData={swapData}
      copiedAddress={copiedAddress}
      onCopyAddress={handleCopy}
      sourceSymbol={sourceSymbol}
      targetSymbol={targetSymbol}
      targetChainOverride={toChain(targetNetwork)}
    >
      <div className="bg-muted/50 w-full max-w-md space-y-3 rounded-lg p-4">
        <AmountRow label="Amount Sent">
          {config.sourceAmount} {sourceSymbol} on {sourceNetwork}
        </AmountRow>
        <AmountRow label="Amount Received">
          {cctpStatus !== "COMPLETE" ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
              <span className="text-muted-foreground">pending</span>
            </span>
          ) : cctpAmount ? (
            <>
              {(Number(cctpAmount) / 1e6).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}{" "}
              {targetSymbol} on {targetNetwork}
            </>
          ) : (
            <>
              {config.targetAmount} {targetSymbol} on {targetNetwork}
            </>
          )}
        </AmountRow>

        {config.targetAddress && (
          <AddressRow
            label="Sent to Address"
            address={config.targetAddress}
            chain={toChain(targetNetwork)}
            copiedAddress={copiedAddress}
            onCopy={handleCopy}
          />
        )}

        {config.swapTxId && (
          <TxHashRow
            label={`Swap Transaction (${bridgeInfo.sourceChainName})`}
            txHash={config.swapTxId}
            chain={swapData.target_token.chain}
            copiedAddress={copiedAddress}
            onCopy={handleCopy}
          />
        )}

        <CrossChainStatusRow
          status={bridgeStatusKind}
          statusText={statusText}
          description={description}
        />

        {forwardTxHash && (
          <TxHashRow
            label={`Destination Transaction (${targetNetwork})`}
            txHash={forwardTxHash}
            chain={toChain(targetNetwork)}
            copiedAddress={copiedAddress}
            onCopy={handleCopy}
          />
        )}
      </div>
    </SuccessLayout>
  );
}
