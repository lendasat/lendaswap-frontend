import {
  type EvmToArkadeSwapResponse,
  type EvmToBitcoinSwapResponse,
  type EvmToLightningSwapResponse,
  isArkade,
  isLightning,
  toChainName,
} from "@lendasat/lendaswap-sdk-pure";
import { useModal } from "connectkit";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { Button } from "#/components/ui/button";
import { getViemChain } from "../../utils/tokenUtils";
import { DepositCard, AmountSummary, AmountRow } from "../components";

interface EvmDepositStepProps {
  swapData:
    | EvmToArkadeSwapResponse
    | EvmToBitcoinSwapResponse
    | EvmToLightningSwapResponse;
  swapId: string;
}

export function DepositEvmStep({ swapData, swapId }: EvmDepositStepProps) {
  const navigate = useNavigate();
  const chain = getViemChain(swapData.source_token.chain);

  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { switchChainAsync } = useSwitchChain();
  const { setOpen } = useModal();

  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState("");

  // Open wallet connect dialog when landing on page if not connected
  useEffect(() => {
    if (!address) {
      setOpen(true);
    }
  }, [address, setOpen]);

  const tokenSymbol = swapData.source_token.symbol;
  const sourceDecimals = swapData.source_token.decimals;
  const sourceAmount = (
    Number(swapData.source_amount) /
    10 ** sourceDecimals
  ).toFixed(sourceDecimals);

  const targetDecimals = swapData.target_token.decimals;
  const targetAmount = (
    Number(swapData.target_amount) /
    10 ** targetDecimals
  ).toFixed(targetDecimals);

  const receiveLabel = isLightning(swapData.target_token)
    ? "We will send"
    : isArkade(swapData.target_token)
      ? "You Receive"
      : "You Receive";

  const handleSign = async () => {
    if (!address) {
      setOpen(true);
      return;
    }

    if (!walletClient || !publicClient) {
      setOpen(true);
      return;
    }

    if (!switchChainAsync) {
      setError("Chain switching not available. Please refresh and try again.");
      return;
    }

    setIsSigning(true);
    setError("");

    try {
      if (!chain) {
        throw new Error(
          `Could not switch to chain for token: ${swapData.source_token}`,
        );
      }

      await switchChainAsync({ chainId: chain.id });
      // FIXME: implement ERC20 approve + fund swap transaction
    } catch (err) {
      console.error("Transaction error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to execute transaction",
      );
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <DepositCard
      sourceToken={swapData.source_token}
      swapId={swapId}
      title={`Send ${tokenSymbol}`}
    >
      <AmountSummary>
        <AmountRow
          label="You Send"
          value={`${sourceAmount} ${tokenSymbol} on ${toChainName(swapData.source_token.chain)}`}
        />
        <AmountRow
          label={receiveLabel}
          value={`~${targetAmount} ${swapData.target_token.symbol} on ${toChainName(swapData.target_token.chain)}`}
        />
        <AmountRow
          label="Fee"
          value={`${swapData.fee_sats.toLocaleString()} sats`}
        />
      </AmountSummary>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20">
          {error}
        </div>
      )}

      {/* Wallet Connection Warning */}
      {!address && (
        <div className="rounded-lg border border-orange-500 bg-orange-50 p-3 text-sm text-orange-600 dark:bg-orange-950/20">
          Please connect your wallet to continue
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleSign}
          disabled={isSigning}
          className="h-12 w-full text-base font-semibold"
        >
          {isSigning ? (
            <>
              <Loader className="animate-spin h-4 w-4 mr-2" />
              Processing Transactions...
            </>
          ) : !address ? (
            "Connect Wallet"
          ) : (
            "Fund Swap"
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
