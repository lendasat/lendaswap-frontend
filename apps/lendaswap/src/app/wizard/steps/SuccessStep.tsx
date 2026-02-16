import {
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  Heart,
} from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import { isValidSpeedWalletContext } from "../../../utils/speedWallet";
import { type GetSwapResponse, getTokenNetworkName } from "../../api";
import {
  getBlockexplorerAddressLink,
  getBlockexplorerTxLink,
  getTokenIcon,
  getTokenNetworkIcon,
} from "../../utils/tokenUtils";

interface SuccessStepProps {
  swapData: GetSwapResponse;
  swapId: string;
}

interface DirectionConfig {
  sentAmount: string;
  receivedAmount: string;
  receiveAddress?: string | null;
  isLightning: boolean;
  swapTxId?: string | null;
  tweetText: string;
}

export function SuccessStep({ swapData, swapId }: SuccessStepProps) {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Calculate swap duration if we have timestamps
  const swapDurationSeconds = swapData.created_at
    ? Math.floor((Date.now() - new Date(swapData.created_at).getTime()) / 1000)
    : null;

  // Track swap completion event
  useEffect(() => {
    posthog?.capture("swap_completed", {
      swap_id: swapId,
      swap_direction: swapData.direction,
      source_token: swapData.source_token,
      target_token: swapData.target_token,
      fee_sats: swapData.fee_sats,
      duration_seconds: swapDurationSeconds,
    });
  }, [swapId, swapData, posthog, swapDurationSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const handleStartNewSwap = () => {
    navigate("/", { replace: true });
  };

  const sourceSymbol = swapData.source_token.symbol;
  const targetSymbol = swapData.target_token.symbol;
  const sourceNetwork = getTokenNetworkName(swapData.source_token);
  const targetNetwork = getTokenNetworkName(swapData.target_token);

  function makeTweet(sent: string, received: string): string {
    return `Swapped ${sent} ${sourceSymbol} → ${received} ${targetSymbol} in ${swapDurationSeconds}s on @lendasat\n\nTrustless atomic swap via @arkade_os`;
  }

  // Build config based on the discriminated direction field
  const getConfig = (): DirectionConfig => {
    switch (swapData.direction) {
      case "btc_to_arkade": {
        const sent = swapData.source_amount.toLocaleString();
        const received = swapData.target_amount.toLocaleString();
        return {
          sentAmount: sent,
          receivedAmount: received,
          receiveAddress: swapData.target_arkade_address,
          isLightning: false,
          swapTxId: swapData.arkade_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "bitcoin_to_evm": {
        const sent = swapData.source_amount.toLocaleString();
        const received = swapData.target_amount.toLocaleString();
        return {
          sentAmount: sent,
          receivedAmount: received,
          receiveAddress:
            swapData.target_evm_address ?? swapData.client_evm_address,
          isLightning: false,
          swapTxId: swapData.evm_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "arkade_to_evm": {
        const sent = swapData.source_amount.toLocaleString();
        const received = (swapData.target_amount ?? 0).toLocaleString();
        return {
          sentAmount: sent,
          receivedAmount: received,
          receiveAddress:
            swapData.target_evm_address ?? swapData.client_evm_address,
          isLightning: false,
          swapTxId: swapData.evm_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "evm_to_arkade": {
        const sent = swapData.source_amount.toLocaleString();
        const received = swapData.target_amount.toLocaleString();
        return {
          sentAmount: sent,
          receivedAmount: received,
          receiveAddress: swapData.target_arkade_address,
          isLightning: false,
          swapTxId: swapData.btc_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "evm_to_bitcoin": {
        const sent = swapData.source_amount.toLocaleString();
        const received = swapData.target_amount.toLocaleString();
        return {
          sentAmount: sent,
          receivedAmount: received,
          receiveAddress: swapData.btc_htlc_address,
          isLightning: false,
          swapTxId: swapData.btc_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "lightning_to_evm": {
        const sent = swapData.btc_expected_sats.toLocaleString();
        const received = (swapData.target_amount ?? 0).toLocaleString();
        return {
          sentAmount: sent,
          receivedAmount: received,
          receiveAddress:
            swapData.target_evm_address ?? swapData.client_evm_address,
          isLightning: false,
          swapTxId: swapData.evm_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
      case "evm_to_lightning": {
        const sent = swapData.source_amount.toLocaleString();
        const received = swapData.target_amount.toLocaleString();
        return {
          sentAmount: sent,
          receivedAmount: received,
          receiveAddress: swapData.client_lightning_invoice,
          isLightning: true,
          swapTxId: swapData.evm_claim_txid,
          tweetText: makeTweet(sent, received),
        };
      }
    }
  };

  const config = getConfig();

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
            {swapId.slice(0, 8)}…
          </code>
          <div className="h-2 w-2 rounded-full bg-green-500" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex flex-col items-center space-y-6">
          {/* Success Icon */}
          <div className="bg-foreground flex h-16 w-16 items-center justify-center rounded-full">
            <Check className="text-background h-8 w-8" />
          </div>

          {/* Success Message */}
          <div className="space-y-2 text-center">
            {isValidSpeedWalletContext() ? (
              <h3 className="text-2xl font-semibold flex items-center justify-center gap-2">
                Speed <Heart className="h-6 w-6 text-red-500 fill-red-500" />{" "}
                LendaSwap
              </h3>
            ) : (
              <h3 className="text-2xl font-semibold">Swap Complete!</h3>
            )}
            <p className="text-muted-foreground text-sm">
              Your {targetSymbol} has been successfully sent to your address
            </p>
          </div>

          {/* Transaction Details */}
          <div className="bg-muted/50 w-full max-w-md space-y-3 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Sent</span>
              <span className="font-medium">
                {config.sentAmount} {sourceSymbol}
                {" on "}
                {sourceNetwork}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Received</span>
              <span className="font-medium">
                {config.receivedAmount} {targetSymbol} {" on "}
                {targetNetwork}
              </span>
            </div>
            {config.receiveAddress && (
              <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
                <span className="text-muted-foreground">
                  {config.isLightning
                    ? "Sent to Invoice/Address"
                    : "Sent to Address"}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`${getBlockexplorerAddressLink(swapData.target_token.chain, config.receiveAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 break-all font-mono text-xs hover:underline"
                  >
                    {config.receiveAddress}
                  </a>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        handleCopyAddress(config.receiveAddress ?? "")
                      }
                      className="h-8 w-8"
                    >
                      {copiedAddress === config.receiveAddress ? (
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
                        href={`${getBlockexplorerAddressLink(swapData.target_token.chain, config.receiveAddress)}`}
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
            <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
              <span className="text-muted-foreground">Transaction Hash</span>
              {config.swapTxId ? (
                <div className="flex items-center gap-2">
                  <a
                    href={`${getBlockexplorerTxLink(swapData.target_token.chain, config.swapTxId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 break-all font-mono text-xs hover:underline"
                  >
                    {config.swapTxId}
                  </a>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopyAddress(config.swapTxId || "")}
                      className="h-8 w-8"
                    >
                      {copiedAddress === config.swapTxId ? (
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
                        href={`${getBlockexplorerTxLink(swapData.target_token.chain, config.swapTxId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground font-mono text-xs">
                  N/A
                </span>
              )}
            </div>
          </div>

          {/* Action Button */}
          <Button
            className="h-12 w-full max-w-md text-base font-semibold"
            onClick={handleStartNewSwap}
          >
            Start New Swap
          </Button>
        </div>
      </div>
    </div>
  );
}
