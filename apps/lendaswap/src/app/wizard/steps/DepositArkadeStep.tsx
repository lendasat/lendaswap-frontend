import { useState } from "react";
import { useNavigate } from "react-router";
import { useWalletBridge } from "../../WalletBridgeContext";
import type { ArkadeToEvmSwapResponse } from "@lendasat/lendaswap-sdk-pure";
import {
  DepositCard,
  QrCodeSection,
  AddressDisplay,
  AmountSummary,
  AmountRow,
  DepositActions,
} from "../components";

interface DepositArkadeStepProps {
  swapData: ArkadeToEvmSwapResponse;
}

export function DepositArkadeStep({ swapData }: DepositArkadeStepProps) {
  const navigate = useNavigate();
  const { client, isEmbedded, isReady } = useWalletBridge();
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const arkadeAddress = swapData.btc_vhtlc_address;
  const tokenSymbol = swapData.target_token.symbol;
  const tokenAmount = (
    swapData.target_amount /
    10 ** swapData.target_token.decimals
  ).toFixed(swapData.target_token.decimals);

  const bip21Url = `bitcoin:?arkade=${arkadeAddress}&amount=${(swapData.source_amount / 100_000_000).toFixed(8)}`;

  const handleSendFromWallet = async () => {
    if (!client || !arkadeAddress) return;
    try {
      setIsSending(true);
      setSendError(null);
      await client.sendToAddress(
        arkadeAddress,
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

  return (
    <DepositCard sourceToken={swapData.source_token} swapId={swapData.id}>
      <QrCodeSection value={bip21Url} />
      <AddressDisplay label="Arkade Address" value={arkadeAddress} />
      <AmountSummary>
        <AmountRow
          label="Required Sats"
          value={`${swapData.source_amount.toLocaleString()} sats`}
          copiable
        />
        <AmountRow
          label="You Receive"
          value={`${tokenAmount} ${tokenSymbol}`}
        />
        <AmountRow
          label="Fee"
          value={`${swapData.fee_sats.toLocaleString()} sats`}
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
