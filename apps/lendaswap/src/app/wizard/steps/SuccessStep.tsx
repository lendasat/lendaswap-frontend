import { isLightning } from "@lendasat/lendaswap-sdk-pure";
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
import {
  type BtcToArkadeSwapResponse,
  type BtcToEvmSwapResponse,
  type EvmToBtcSwapResponse,
  type GetSwapResponse,
  getTokenNetworkName,
  getTokenSymbol,
  type OnchainToEvmSwapResponse,
} from "../../api";
import {
  getBlockexplorerAddressLink,
  getBlockexplorerTxLink,
  getTokenIcon,
  getTokenNetworkIcon,
} from "../../utils/tokenUtils";

interface SuccessStepProps {
  swapData: GetSwapResponse;
  swapDirection:
    | "btc-to-evm"
    | "evm-to-btc"
    | "btc-to-arkade"
    | "onchain-to-evm";
  swapId: string;
}

export function SuccessStep({
  swapData,
  swapDirection,
  swapId,
}: SuccessStepProps) {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Track swap completion event
  useEffect(() => {
    const swapDurationSeconds = swapData.created_at
      ? Math.floor(
          (Date.now() - new Date(swapData.created_at).getTime()) / 1000,
        )
      : null;

    // Resolve USD amount based on swap direction
    let amountUsd: number | null = null;
    let amountSats: number | null = null;

    if (swapDirection === "btc-to-evm") {
      const d = swapData as BtcToEvmSwapResponse;
      amountUsd = d.asset_amount;
      amountSats = d.sats_receive;
    } else if (swapDirection === "evm-to-btc") {
      const d = swapData as EvmToBtcSwapResponse;
      amountUsd = d.asset_amount;
      amountSats = d.sats_receive;
    } else if (swapDirection === "onchain-to-evm") {
      const d = swapData as OnchainToEvmSwapResponse;
      amountUsd = d.target_amount;
      amountSats = d.source_amount;
    } else if (swapDirection === "btc-to-arkade") {
      const d = swapData as BtcToArkadeSwapResponse;
      amountSats = d.sats_receive;
    }

    posthog?.capture("swap_completed", {
      swap_id: swapId,
      swap_direction: swapDirection,
      source_token: swapData.source_token,
      target_token: swapData.target_token,
      amount_usd: amountUsd,
      amount_sats: amountSats,
      fee_sats: swapData.fee_sats,
      duration_seconds: swapDurationSeconds,
    });
  }, [swapId, swapDirection, swapData, posthog]);

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

  // Calculate swap duration if we have timestamps
  const swapDurationSeconds = swapData.created_at
    ? Math.floor((Date.now() - new Date(swapData.created_at).getTime()) / 1000)
    : null;

  // Define config based on swap direction
  const getConfig = () => {
    if (swapDirection === "btc-to-evm") {
      const btcToEvmData = swapData as BtcToEvmSwapResponse;
      return {
        sentTokenSymbol: "sats",
        sentTokenNetwork: getTokenNetworkName(swapData.source_token),
        sentAmount: btcToEvmData.sats_receive.toLocaleString(),
        receivedTokenSymbol: getTokenSymbol(swapData.target_token),
        receivedTokenNetwork: getTokenNetworkName(swapData.target_token),
        receivedAmount: btcToEvmData.asset_amount.toString(),
        receiveAddress: btcToEvmData.user_address_evm,
        receiveAddressIsEvm: true,
        isLightning: false,
        swapTxId: btcToEvmData.evm_htlc_claim_txid,
        swapTxIdIsEvm: true,
        tweetText: `Swapped ${btcToEvmData.sats_receive.toLocaleString()} sats → $${btcToEvmData.asset_amount.toFixed(2)} ${getTokenSymbol(swapData.target_token)} in ${swapDurationSeconds}s on @lendasat\n\nTrustless atomic swap via @arkade_os`,
      };
    } else if (swapDirection === "btc-to-arkade") {
      const btcToArkadeData = swapData as BtcToArkadeSwapResponse;
      return {
        sentTokenSymbol: "sats",
        sentTokenNetwork: "Bitcoin",
        sentAmount: btcToArkadeData.asset_amount.toLocaleString(),
        receivedTokenSymbol: "sats",
        receivedTokenNetwork: "Arkade",
        receivedAmount: btcToArkadeData.sats_receive.toLocaleString(),
        receiveAddress: btcToArkadeData.target_arkade_address,
        receiveAddressIsEvm: false,
        isLightning: false,
        swapTxId: btcToArkadeData.arkade_claim_txid,
        swapTxIdIsEvm: false,
        tweetText: `On-ramped ${btcToArkadeData.sats_receive.toLocaleString()} sats from Bitcoin mainchain to @arkade_os in ${swapDurationSeconds}s on @lendasat\n\nTrustless atomic swap!`,
      };
    } else if (swapDirection === "onchain-to-evm") {
      const btcToEvmSwap = swapData as OnchainToEvmSwapResponse;
      return {
        sentTokenSymbol: "sats",
        sentTokenNetwork: "Bitcoin",
        sentAmount: btcToEvmSwap.source_amount.toLocaleString(),
        receivedTokenSymbol: getTokenSymbol(btcToEvmSwap.target_token),
        receivedTokenNetwork: getTokenNetworkName(btcToEvmSwap.target_token),
        receivedAmount: btcToEvmSwap.target_amount.toLocaleString(),
        receiveAddress: btcToEvmSwap.client_evm_address,
        receiveAddressIsEvm: false,
        isLightning: false,
        swapTxId: btcToEvmSwap.evm_claim_txid,
        swapTxIdIsEvm: false,
        tweetText: `Swapped ${btcToEvmSwap.source_amount.toLocaleString()} sats from Bitcoin mainchain on @lendasat\n\nTrustless atomic swap!`,
      };
    } else {
      // evm-to-btc
      const evmToBtcData = swapData as EvmToBtcSwapResponse;
      return {
        sentTokenSymbol: getTokenSymbol(swapData.source_token),
        sentTokenNetwork: getTokenNetworkName(swapData.source_token),
        sentAmount: evmToBtcData.source_amount.toFixed(2),
        receivedTokenSymbol: "sats",
        receivedTokenNetwork: getTokenNetworkName(swapData.target_token),
        receivedAmount: evmToBtcData.sats_receive.toLocaleString(),
        // For Lightning swaps, show the invoice/address; for Arkade, show the Arkade address
        receiveAddress: isLightning(swapData.target_token)
          ? (swapData as EvmToBtcSwapResponse).ln_invoice
          : (swapData as EvmToBtcSwapResponse).user_address_arkade,
        receiveAddressIsEvm: false,
        isLightning: isLightning(swapData.target_token),
        swapTxId: evmToBtcData.bitcoin_htlc_claim_txid,
        swapTxIdIsEvm: false,
        tweetText: `Swapped $${evmToBtcData.asset_amount.toFixed(2)} ${getTokenSymbol(swapData.source_token)} → ${evmToBtcData.sats_receive.toLocaleString()} sats in ${swapDurationSeconds}s on @lendasat\n\nTrustless atomic swap via @arkade_os`,
      };
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
            {getTokenSymbol(swapData.source_token)} →{" "}
            {getTokenSymbol(swapData.target_token)}
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
              Your {config.receivedTokenSymbol} has been successfully sent to
              your address
            </p>
          </div>

          {/* Transaction Details */}
          <div className="bg-muted/50 w-full max-w-md space-y-3 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Sent</span>
              <span className="font-medium">
                {config.sentAmount} {config.sentTokenSymbol}
                {" on "}
                {config.sentTokenNetwork}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Received</span>
              <span className="font-medium">
                {config.receivedAmount} {config.receivedTokenSymbol} {" on "}
                {config.receivedTokenNetwork}
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
                    href={`${getBlockexplorerAddressLink(swapData.target_token, config.receiveAddress)}`}
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
                        href={`${getBlockexplorerAddressLink(swapData.target_token, config.receiveAddress)}`}
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
                    href={`${getBlockexplorerTxLink(swapData.target_token, config.swapTxId)}`}
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
                        href={`${getBlockexplorerTxLink(swapData.target_token, config.swapTxId)}`}
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
