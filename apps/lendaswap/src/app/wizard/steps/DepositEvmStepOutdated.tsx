import { useModal } from "connectkit";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { Button } from "#/components/ui/button";
import { api } from "../../api";
import { getViemChainById } from "../../utils/tokenUtils";
import type { EvmToArkadeSwapResponse } from "@lendasat/lendaswap-sdk-pure";

interface DepositEvmStepProps {
  swapData: EvmToArkadeSwapResponse;
  swapId: string;
}

export function DepositEvmStepOutdated({
  swapData,
  swapId,
}: DepositEvmStepProps) {
  const chain = getViemChainById(swapData.evm_chain_id);

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
  const tokenDecimals = swapData.source_token.decimals;
  const targetAmount = swapData.target_amount
    ? (Number(swapData.target_amount) / 100_000_000).toFixed(8)
    : 0;

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
        throw new Error(`Unsupported chain ID: ${swapData.evm_chain_id}`);
      }

      // Switch to the correct chain if needed
      console.log("Switching to chain:", chain.name);
      await switchChainAsync({ chainId: chain.id });

      // Get coordinator funding calldata from SDK
      console.log("Getting coordinator funding calldata...");
      const funding = await api.getCoordinatorFundingCallData(swapId);

      // Step 1: Approve source token to coordinator
      console.log("Step 1: Approving source token to coordinator...");
      const approveTxHash = await walletClient.sendTransaction({
        to: funding.approve.to as `0x${string}`,
        data: funding.approve.data as `0x${string}`,
        chain,
      });

      console.log("Approve transaction hash:", approveTxHash);
      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxHash,
      });

      console.log("Approve transaction confirmed:", approveReceipt.status);
      if (approveReceipt.status !== "success") {
        throw new Error("Approve transaction failed");
      }

      // Step 2: Execute swap + create HTLC
      console.log("Step 2: Executing coordinator swap + HTLC creation...");
      const executeTxHash = await walletClient.sendTransaction({
        to: funding.executeAndCreate.to as `0x${string}`,
        data: funding.executeAndCreate.data as `0x${string}`,
        chain,
      });

      console.log("ExecuteAndCreate transaction hash:", executeTxHash);
      const executeReceipt = await publicClient.waitForTransactionReceipt({
        hash: executeTxHash,
      });

      console.log(
        "ExecuteAndCreate transaction confirmed:",
        executeReceipt.status,
      );
      if (executeReceipt.status !== "success") {
        throw new Error(
          `ExecuteAndCreate transaction failed: ${executeReceipt.status}`,
        );
      }

      console.log("Both transactions completed successfully!");
      // The wizard will automatically move to the next step via polling
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
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
      {/* Swap ID Header */}
      <div className="px-6 py-4 flex items-center gap-3 border-b border-border/50 bg-muted/30">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Swap ID:
        </p>
        <code className="text-xs font-mono text-foreground flex-1">
          {swapId}
        </code>
        <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
      </div>

      {/* Content */}
      <div className="space-y-6 p-6">
        {/* Amount Reminder */}
        <div className="bg-muted/50 space-y-2 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You Send</span>
            <span className="font-medium">
              {swapData.source_amount} {tokenSymbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You Receive</span>
            <span className="font-medium">~{targetAmount} BTC on Arkade</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground" />
            <span className="text-muted-foreground">
              (~{targetAmount} sats)
            </span>
          </div>
        </div>

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
        </div>
      </div>
    </div>
  );
}
