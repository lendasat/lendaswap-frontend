import {
  getLzExplorerUrl,
  type LayerZeroMessageStatus,
  toChain,
  trackLzMessage,
} from "@lendasat/lendaswap-sdk-pure";
import { ExternalLink } from "lucide-react";
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

export function Usdt0Details({ swapData }: { swapData: GetSwapResponse }) {
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

  // LayerZero tracking state
  const [bridgeStatus, setBridgeStatus] =
    useState<LayerZeroMessageStatus | null>(null);
  const [dstTxHash, setDstTxHash] = useState<string | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  useEffect(() => {
    if (!bridgeTxHash) return;
    let cancelled = false;

    trackLzMessage({
      txHash: bridgeTxHash,
      pollIntervalMs: 5_000,
      timeoutMs: 600_000,
      onStatusChange: (status) => {
        if (!cancelled) setBridgeStatus(status);
      },
    })
      .then((result) => {
        if (!cancelled) {
          setBridgeStatus("DELIVERED");
          setDstTxHash(result.dstTxHash ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) setBridgeError(String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [bridgeTxHash]);

  const bridgeStatusKind: "pending" | "complete" | "error" = bridgeError
    ? "error"
    : bridgeStatus === "DELIVERED"
      ? "complete"
      : "pending";

  const statusText =
    bridgeStatus === "CONFIRMING"
      ? "Confirming..."
      : `Bridging to ${targetNetwork}...`;

  const description =
    bridgeStatus === "DELIVERED" ? (
      <>Arrived on {targetNetwork} via LayerZero.</>
    ) : bridgeError ? (
      <>
        Tracking failed. Your funds are safe — check{" "}
        <a
          href={getLzExplorerUrl(bridgeTxHash!)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          LayerZero Scan
        </a>{" "}
        for status.
      </>
    ) : (
      <>
        Bridging from Arbitrum to {targetNetwork} via LayerZero. Usually 30-60s.
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
          {config.targetAmount} {targetSymbol} on {targetNetwork}
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

        {dstTxHash && (
          <TxHashRow
            label={`Destination Transaction (${targetNetwork})`}
            txHash={dstTxHash}
            chain={toChain(targetNetwork)}
            copiedAddress={copiedAddress}
            onCopy={handleCopy}
          />
        )}

        {bridgeTxHash && (
          <div className="pt-1">
            <a
              href={getLzExplorerUrl(bridgeTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
              View on LayerZero Scan
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </SuccessLayout>
  );
}
