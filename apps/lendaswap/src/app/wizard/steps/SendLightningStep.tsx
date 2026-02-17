import { Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import {
  isValidSpeedWalletContext,
  triggerSpeedWalletPayment,
} from "../../../utils/speedWallet";
import { useWalletBridge } from "../../WalletBridgeContext";
import {
  toChainName,
  type LightningToEvmSwapResponse,
} from "@lendasat/lendaswap-sdk-pure";
import {
  DepositCard,
  QrCodeSection,
  AddressDisplay,
  AmountSummary,
  AmountRow,
  DepositActions,
} from "../components";

interface SendLightningStepProps {
  swapData: LightningToEvmSwapResponse;
}

export function SendLightningStep({ swapData }: SendLightningStepProps) {
  const navigate = useNavigate();
  const { client, isEmbedded, isReady } = useWalletBridge();
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [speedPaymentTriggered, setSpeedPaymentTriggered] = useState(false);

  const lightningInvoice = swapData.boltz_invoice;
  const lightningQrValue = `lightning:${lightningInvoice}`;
  const tokenAmount = swapData.target_amount.toString();
  const tokenSymbol = swapData.target_token.symbol;

  const isSpeedWallet = isValidSpeedWalletContext();

  const handleSendFromWallet = async () => {
    if (!client) return;
    try {
      setIsSending(true);
      setSendError(null);
      await client.sendToAddress(
        lightningInvoice,
        swapData.source_amount,
        "bitcoin",
      );
    } catch (error) {
      console.error("Failed to send from wallet:", error);
      setSendError(
        error instanceof Error ? error.message : "Failed to send from wallet",
      );
      setIsSending(false);
    }
  };

  const handleSpeedWalletPayment = () => {
    if (!lightningInvoice) {
      setSendError("Payment details not available");
      return;
    }

    const success = triggerSpeedWalletPayment(
      lightningInvoice,
      swapData.source_amount,
      `LendaSwap: ${tokenAmount} ${tokenSymbol} swap`,
    );

    if (success) {
      setSpeedPaymentTriggered(true);
      setSendError(null);
    } else {
      setSendError("Failed to trigger Speed Wallet payment");
    }
  };

  // Speed Wallet mode: simplified UI with pay button
  if (isSpeedWallet) {
    return (
      <DepositCard
        sourceToken={swapData.source_token}
        swapId={swapData.id}
        title="Pay with Speed Wallet"
      >
        <p className="text-sm text-muted-foreground text-center">
          Tap the button below to complete your payment
        </p>

        <AmountSummary>
          <AmountRow
            label="You Receive"
            value={`${tokenAmount} ${tokenSymbol} on ${toChainName(swapData.target_token.chain)}`}
          />
        </AmountSummary>

        {sendError && (
          <div className="rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20">
            {sendError}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            className="h-14 w-full text-base font-semibold"
            onClick={handleSpeedWalletPayment}
            disabled={speedPaymentTriggered}
          >
            {speedPaymentTriggered ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Waiting for payment...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-5 w-5" />
                Pay {swapData.source_amount.toLocaleString()} sats
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="h-12 w-full"
            onClick={() => navigate("/")}
          >
            Cancel Swap
          </Button>
        </div>
      </DepositCard>
    );
  }

  // Standard mode: QR code + invoice + wallet bridge
  return (
    <DepositCard sourceToken={swapData.source_token} swapId={swapData.id}>
      <QrCodeSection value={lightningQrValue} />
      <AddressDisplay label="Lightning Invoice" value={lightningInvoice} />
      <AmountSummary>
        <AmountRow
          label="You Receive"
          value={`${tokenAmount} ${tokenSymbol} on ${toChainName(swapData.target_token.chain)}`}
        />
      </AmountSummary>
      <DepositActions
        onSendFromWallet={
          isEmbedded && isReady && client ? handleSendFromWallet : undefined
        }
        onCancel={() => navigate("/")}
        isSending={isSending}
        sendError={sendError}
      />
    </DepositCard>
  );
}
