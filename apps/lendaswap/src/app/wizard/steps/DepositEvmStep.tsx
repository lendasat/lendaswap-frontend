import {
  type EvmToArkadeSwapResponse,
  type EvmToBitcoinSwapResponse,
  type EvmToLightningSwapResponse,
  isArkade,
  isLightning,
  toChainName,
} from "@lendasat/lendaswap-sdk-pure";
import { useModal } from "connectkit";
import {
  Check,
  Circle,
  Loader,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  useAccount,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { erc20Abi, publicActions } from "viem";
import { Button } from "#/components/ui/button";
import { api } from "../../api";
import { getViemChain } from "../../utils/tokenUtils";
import { DepositCard, AmountSummary, AmountRow } from "../components";

type StepStatus = "pending" | "active" | "completed" | "error";

interface StepState {
  status: StepStatus;
  error?: string;
}

interface EvmDepositStepProps {
  swapData:
    | EvmToArkadeSwapResponse
    | EvmToBitcoinSwapResponse
    | EvmToLightningSwapResponse;
  swapId: string;
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return <Check className="h-4 w-4 text-green-500" />;
    case "active":
      return <Loader className="h-4 w-4 animate-spin text-primary" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  }
}

/** Replay a reverted tx to extract the on-chain revert reason. */
async function getRevertReason(
  client: ReturnType<typeof publicActions>,
  txHash: `0x${string}`,
  blockNumber: bigint,
): Promise<string> {
  try {
    const tx = await client.getTransaction({ hash: txHash });
    if (!tx.to) return "Transaction reverted";
    await client.call({
      to: tx.to,
      data: tx.input,
      account: tx.from,
      blockNumber,
    });
    return "Transaction reverted";
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : String(err);
    // Extract the revert reason from viem's error message
    const match = msg.match(/reverted with.*?:\s*(.+)/i)
      ?? msg.match(/reason:\s*(.+)/i);
    return match?.[1]?.trim() ?? msg;
  }
}

export function DepositEvmStep({ swapData, swapId }: EvmDepositStepProps) {
  const navigate = useNavigate();
  const chain = getViemChain(swapData.source_token.chain);

  const { address, chainId: currentChainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const walletPublicClient = walletClient?.extend(publicActions);
  const { switchChainAsync } = useSwitchChain();
  const { setOpen } = useModal();

  const [steps, setSteps] = useState<Record<string, StepState>>({
    switchChain: { status: "pending" },
    approve: { status: "pending" },
    fund: { status: "pending" },
  });
  const [isRunning, setIsRunning] = useState(false);

  // Open wallet connect dialog when landing on page if not connected
  useEffect(() => {
    if (!address) {
      setOpen(true);
    }
  }, [address, setOpen]);

  // Cache funding calldata so we don't fetch it multiple times
  const fundingRef = useRef<Awaited<
    ReturnType<typeof api.getCoordinatorFundingCallData>
  > | null>(null);

  const fetchFunding = useCallback(async () => {
    if (!fundingRef.current) {
      fundingRef.current = await api.getCoordinatorFundingCallData(swapId);
    }
    return fundingRef.current;
  }, [swapId]);

  // Auto-mark switchChain as completed if already on the correct chain
  useEffect(() => {
    if (chain && currentChainId === chain.id) {
      setSteps((prev) => ({
        ...prev,
        switchChain: { status: "completed" },
      }));
    }
  }, [currentChainId, chain]);

  // Auto-mark approve as completed if allowance is already sufficient
  useEffect(() => {
    if (!address || !walletPublicClient || !chain || currentChainId !== chain.id) return;

    let cancelled = false;
    (async () => {
      try {
        const funding = await fetchFunding();
        const tokenAddress = funding.approve.to as `0x${string}`;
        const spender = funding.executeAndCreate.to as `0x${string}`;

        const allowance = await walletPublicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, spender],
        });

        if (!cancelled && allowance >= BigInt(swapData.source_amount)) {
          setSteps((prev) => ({
            ...prev,
            approve: { status: "completed" },
          }));
        }
      } catch (err) {
        console.error("Failed to check allowance:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [address, walletPublicClient, chain, currentChainId, swapData.source_amount, fetchFunding]);

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

  const updateStep = (key: string, state: StepState) => {
    setSteps((prev) => ({ ...prev, [key]: state }));
  };

  const runFromStep = async (startFrom: "switchChain" | "approve" | "fund") => {
    if (!address) {
      setOpen(true);
      return;
    }
    if (!walletClient || !walletPublicClient) {
      setOpen(true);
      return;
    }
    if (!switchChainAsync || !chain) {
      return;
    }

    setIsRunning(true);

    const stepOrder: Array<"switchChain" | "approve" | "fund"> = [
      "switchChain",
      "approve",
      "fund",
    ];
    const startIndex = stepOrder.indexOf(startFrom);

    try {
      for (let i = startIndex; i < stepOrder.length; i++) {
        const step = stepOrder[i];

        updateStep(step, { status: "active" });

        if (step === "switchChain") {
          await switchChainAsync({ chainId: chain.id });
          updateStep(step, { status: "completed" });
        }

        if (step === "approve") {
          const funding = await fetchFunding();
          const tokenAddress = funding.approve.to as `0x${string}`;
          const spender = funding.executeAndCreate.to as `0x${string}`;

          // Check if allowance is already sufficient
          const allowance = await walletPublicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, spender],
          });

          if (allowance >= BigInt(swapData.source_amount)) {
            updateStep(step, { status: "completed" });
          } else {
            const approveTxHash = await walletClient.sendTransaction({
              to: tokenAddress,
              data: funding.approve.data as `0x${string}`,
              chain,
            });
            const approveReceipt = await walletPublicClient.waitForTransactionReceipt({
              hash: approveTxHash,
            });
            if (approveReceipt.status !== "success") {
              const reason = await getRevertReason(
                walletPublicClient, approveTxHash, approveReceipt.blockNumber,
              );
              updateStep(step, { status: "error", error: reason });
              return;
            }
            updateStep(step, { status: "completed" });
          }
        }

        if (step === "fund") {
          // Invalidate cache and fetch fresh calldata — 1inch quotes expire quickly
          fundingRef.current = null;
          const freshFunding = await fetchFunding();
          const executeTxHash = await walletClient.sendTransaction({
            to: freshFunding.executeAndCreate.to as `0x${string}`,
            data: freshFunding.executeAndCreate.data as `0x${string}`,
            chain,
            gas: 500_000n, // Anvil fork needs extra gas for proxy reentrancy guards
          });
          const executeReceipt =
            await walletPublicClient.waitForTransactionReceipt({
              hash: executeTxHash,
            });
          if (executeReceipt.status !== "success") {
            const reason = await getRevertReason(
              walletPublicClient, executeTxHash, executeReceipt.blockNumber,
            );
            updateStep(step, { status: "error", error: reason });
            return;
          }
          updateStep(step, { status: "completed" });
        }
      }
      // Wizard polling will detect the status change and advance
    } catch (err) {
      console.error("Transaction error:", err);
      // Mark the currently active step as errored
      const activeStep = stepOrder.find(
        (s) => steps[s]?.status === "active" || s === stepOrder[startIndex],
      );
      if (activeStep) {
        updateStep(activeStep, {
          status: "error",
          error:
            err instanceof Error ? err.message : "Transaction failed",
        });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const stepDefs = [
    {
      key: "switchChain" as const,
      label: `Switch to ${chain?.name ?? toChainName(swapData.source_token.chain)}`,
      action: "Switch",
    },
    { key: "approve" as const, label: `Approve ${tokenSymbol} spend`, action: "Approve" },
    { key: "fund" as const, label: "Fund swap", action: "Fund" },
  ];

  // The current step is the first non-completed step
  const currentStepKey = stepDefs.find(
    (s) => steps[s.key].status !== "completed",
  )?.key;

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

      {/* Step Checklist */}
      <div className="space-y-2">
          {stepDefs.map(({ key, label, action }) => {
            const step = steps[key];
            return (
              <div key={key} className="flex items-center gap-3">
                <StepIcon status={step.status} />
                <span
                  className={`text-sm flex-1 ${
                    step.status === "completed"
                      ? "text-muted-foreground line-through"
                      : step.status === "error"
                        ? "text-red-500"
                        : step.status === "active"
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {step.status === "error" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => runFromStep(key)}
                    disabled={isRunning}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
                {key === currentStepKey && step.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs"
                    onClick={() => runFromStep(key)}
                    disabled={isRunning}
                  >
                    {action}
                  </Button>
                )}
              </div>
            );
          })}
          {/* Show error message below the failed step */}
          {stepDefs.map(({ key }) => {
            const step = steps[key];
            if (step.status !== "error" || !step.error) return null;
            return (
              <div
                key={`${key}-error`}
                className="ml-7 rounded-lg border border-red-500 bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/20"
              >
                {step.error}
              </div>
            );
          })}
        </div>

      {/* Wallet Connection Warning */}
      {!address && (
        <div className="rounded-lg border border-orange-500 bg-orange-50 p-3 text-sm text-orange-600 dark:bg-orange-950/20">
          Please connect your wallet to continue
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        {!address ? (
          <Button
            onClick={() => setOpen(true)}
            className="h-12 w-full text-base font-semibold"
          >
            Connect Wallet
          </Button>
        ) : currentStepKey ? (
          <Button
            onClick={() => runFromStep(currentStepKey)}
            disabled={isRunning}
            className="h-12 w-full text-base font-semibold bg-black text-white hover:bg-black/90"
          >
            {isRunning ? (
              <>
                <Loader className="animate-spin h-4 w-4 mr-2" />
                Processing...
              </>
            ) : (
              "Fund Swap"
            )}
          </Button>
        ) : null}

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
