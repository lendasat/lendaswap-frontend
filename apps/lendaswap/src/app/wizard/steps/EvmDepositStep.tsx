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
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { Button } from "#/components/ui/button";
import {
  getTokenIcon,
  getTokenNetworkIcon,
  getViemChain,
} from "../../utils/tokenUtils";

// ERC20 ABI - approve and allowance functions
// const ERC20_ABI = [
//   {
//     inputs: [
//       { name: "spender", type: "address" },
//       { name: "amount", type: "uint256" },
//     ],
//     name: "approve",
//     outputs: [{ name: "", type: "bool" }],
//     stateMutability: "nonpayable",
//     type: "function",
//   },
//   {
//     inputs: [
//       { name: "owner", type: "address" },
//       { name: "spender", type: "address" },
//     ],
//     name: "allowance",
//     outputs: [{ name: "", type: "uint256" }],
//     stateMutability: "view",
//     type: "function",
//   },
// ] as const;

interface EvmDepositStepProps {
  swapData:
    | EvmToArkadeSwapResponse
    | EvmToBitcoinSwapResponse
    | EvmToLightningSwapResponse;
  swapId: string;
}

export function EvmDepositStep({ swapData, swapId }: EvmDepositStepProps) {
  const chain = getViemChain(swapData.source_token.chain);
  console.log(`EVM chain `, chain?.name);

  const { address } = useAccount();
  // Get wallet client without chain restriction - we'll switch chains in handleSign
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

  const handleSign = async () => {
    if (!address) {
      setOpen(true);
      return;
    }

    if (!walletClient || !publicClient) {
      // Wallet just connected, clients may still be initializing - open modal to ensure connection is complete
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

      // Switch to the correct chain if needed
      console.log("Switching to chain:", chain.name);
      await switchChainAsync({ chainId: chain.id });
      // FIXME: implement this
      /*const htlcAddress = swapData.htlc_address_evm as `0x${string}`;
      const tokenAddress = swapData.source_token_address as `0x${string}`;

      // Parse the amount needed for this swap
      const decimals = tokenInfo.decimals;
      const amountNeeded = BigInt(
        Math.floor(swapData.asset_amount * 10 ** decimals),
      );

      console.log("Checking current allowance...");
      console.log("Amount needed:", amountNeeded.toString());

      // Check current allowance
      const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, htlcAddress],
      });

      console.log("Current allowance:", currentAllowance.toString());

      // Only approve if allowance is insufficient
      if (currentAllowance < amountNeeded) {
        console.log(
          "Step 1: Allowance insufficient, approving max amount (user pays gas)",
        );

        // Approve max uint256 to avoid future approvals
        const maxUint256 = BigInt(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        );

        // Execute approve transaction for max amount (user pays gas)
        const approveTxHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [htlcAddress, maxUint256],
          account: address,
          chain,
        });

        console.log("Approve transaction hash:", approveTxHash);
        console.log("Waiting for approval transaction to be mined...");

        // Wait for the approved transaction to be confirmed
        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveTxHash,
        });

        console.log("Approve transaction confirmed:", approveReceipt.status);
        console.log("Approve tx:", approveTxHash);

        if (approveReceipt.status !== "success") {
          throw new Error("Approve transaction failed");
        }
      } else {
        console.log(
          "Step 1: Allowance sufficient, skipping approval transaction",
        );
      }

      console.log("Step 2: Executing createSwap transaction (user pays gas)");

      // Parse create_swap_tx calldata from swap data
      const createSwapCalldata = swapData.create_swap_tx as `0x${string}`;

      // Send createSwap transaction directly (user pays gas)
      const createSwapTxHash = await walletClient.sendTransaction({
        to: htlcAddress,
        data: createSwapCalldata,
        chain,
      });

      console.log("CreateSwap transaction hash:", createSwapTxHash);
      console.log("Waiting for createSwap transaction to be mined...");

      // Wait for the createSwap transaction to be confirmed
      const createSwapReceipt = await publicClient.waitForTransactionReceipt({
        hash: createSwapTxHash,
      });

      console.log(
        "CreateSwap transaction confirmed:",
        createSwapReceipt.status,
      );

      if (createSwapReceipt.status !== "success") {
        throw new Error(
          `CreateSwap transaction failed: ${createSwapReceipt.status}`,
        );
      }

      console.log("Both transactions completed successfully!");
      console.log("CreateSwap tx:", createSwapTxHash);*/

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
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
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
          <h3 className="text-sm font-semibold">Send {tokenSymbol}</h3>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono text-muted-foreground">
            {swapId.slice(0, 8)}…
          </code>
          <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-5 p-5">
        {/* Amount Reminder */}
        <div className="bg-muted/50 space-y-2 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You Send</span>
            <span className="font-medium">
              {sourceAmount} {tokenSymbol} on{" "}
              {toChainName(swapData.source_token.chain)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            {swapData && isLightning(swapData.target_token) && (
              <span className="text-muted-foreground">We will send</span>
            )}
            {swapData && isArkade(swapData.target_token) && (
              <span className="text-muted-foreground">You receive</span>
            )}
            <span className="font-medium">
              ~{targetAmount} BTC on {toChainName(swapData.target_token.chain)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground"></span>
            <span className="text-muted-foreground">
              (~{swapData.target_amount} sats)
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
