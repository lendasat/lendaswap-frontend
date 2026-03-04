import {
  type EvmToArkadeSwapResponse,
  type EvmToBitcoinSwapResponse,
  type EvmToLightningSwapResponse,
  encodeExecuteAndCreateWithPermit2,
  isArkade,
  isBtcOnchain,
  isLightning,
  PERMIT2_ADDRESS,
  toChainName,
  type UnsignedPermit2FundingData,
} from "@lendasat/lendaswap-sdk-pure";
import { useAppKit } from "@reown/appkit/react";
import {
  AlertCircle,
  Check,
  Circle,
  Clock,
  Loader,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { createPublicClient, erc20Abi, http } from "viem";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { Button } from "#/components/ui/button";
import { api } from "../../api";
import { SupportErrorBanner } from "../../components/SupportErrorBanner";
import { getViemChain } from "../../utils/tokenUtils";
import { AmountRow, AmountSummary, DepositCard } from "../components";

type StepStatus = "pending" | "checking" | "active" | "completed" | "error";

interface StepState {
  status: StepStatus;
  error?: string;
}

type StepKey = "switchChain" | "approve" | "fund";

interface StepDef {
  key: StepKey;
  label: string;
  action: string;
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
    case "checking":
      return <Loader className="h-4 w-4 animate-spin text-primary" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  }
}

/** Poll for a transaction receipt — works reliably with Anvil's auto-mine mode. */
async function pollForReceipt(
  // biome-ignore lint/suspicious/noExplicitAny: accepts any viem public client
  client: any,
  hash: `0x${string}`,
  timeoutMs = 60_000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      console.log(
        "[pollForReceipt] got:",
        JSON.stringify(receipt, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      );
      if (receipt?.status != null) return receipt;
    } catch (e) {
      console.log("[pollForReceipt] error:", e);
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error("Timed out waiting for transaction receipt");
}

/** Replay a reverted tx to extract the on-chain revert reason. */
async function getRevertReason(
  // biome-ignore lint/suspicious/noExplicitAny: accepts any viem client with getTransaction + call
  client: any,
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
    const msg = err instanceof Error ? err.message : String(err);
    // Extract the revert reason from viem's error message
    const match =
      msg.match(/reverted with.*?:\s*(.+)/i) ?? msg.match(/reason:\s*(.+)/i);
    return match?.[1]?.trim() ?? msg;
  }
}

const INITIAL_STEPS: Record<string, StepState> = {
  switchChain: { status: "pending" },
  approve: { status: "pending" },
  fund: { status: "pending" },
};

export function DepositEvmStep({ swapData, swapId }: EvmDepositStepProps) {
  const navigate = useNavigate();
  const chain = getViemChain(swapData.source_token.chain);

  const { address, chainId: currentChainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { open } = useAppKit();

  // Direct public client for reliable reads — bypasses wallet transport
  // which returns raw JSON-RPC envelopes instead of parsed responses.
  const rpcClient = useMemo(() => {
    if (!chain) return null;
    const rpcUrl =
      import.meta.env.VITE_RPC_OVERRIDE_CHAIN_ID === String(chain.id)
        ? import.meta.env.VITE_RPC_OVERRIDE_URL
        : undefined;
    return createPublicClient({ chain, transport: http(rpcUrl) });
  }, [chain]);

  // Expiry countdown — field name depends on swap type
  const refundLocktime = isBtcOnchain(swapData.target_token)
    ? ((swapData as EvmToBitcoinSwapResponse).btc_refund_locktime ?? 0)
    : ((swapData as EvmToArkadeSwapResponse | EvmToLightningSwapResponse)
        .vhtlc_refund_locktime ?? 0);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!refundLocktime) return;
    const interval = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(interval);
  }, [refundLocktime]);
  const isExpired = refundLocktime > 0 && now >= refundLocktime;
  const timeRemaining = useMemo(() => {
    if (!refundLocktime || isExpired) return null;
    const secondsLeft = refundLocktime - now;
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [now, refundLocktime, isExpired]);

  const [steps, setSteps] = useState<Record<string, StepState>>({
    ...INITIAL_STEPS,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [userRejected, setUserRejected] = useState<string | null>(null);
  const [insufficientBalance, setInsufficientBalance] = useState(false);

  // Open wallet connect dialog if not connected
  useEffect(() => {
    if (!address) {
      open().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open may not be referentially stable
  }, [address, open]);

  // Cache unsigned Permit2 funding params so we don't fetch multiple times
  const fundingRef = useRef<UnsignedPermit2FundingData | null>(null);

  const chainId = chain?.id;
  const fetchFunding = useCallback(async () => {
    if (!chainId) throw new Error("Chain not resolved");
    if (!fundingRef.current) {
      fundingRef.current = await api.getPermit2FundingParamsUnsigned(
        swapId,
        chainId,
      );
    }
    return fundingRef.current;
  }, [swapId, chainId]);

  // Auto-mark switchChain as completed if already on the correct chain
  useEffect(() => {
    if (chain && currentChainId === chain.id) {
      setSteps((prev) => ({
        ...prev,
        switchChain: { status: "completed" },
      }));
    }
  }, [currentChainId, chain]);

  // Auto-mark approve as completed if allowance to Permit2 is already sufficient
  useEffect(() => {
    if (!address || !rpcClient || !chain || currentChainId !== chain.id) return;

    let cancelled = false;

    setSteps((prev) => ({
      ...prev,
      approve: { status: "checking" },
    }));

    (async () => {
      try {
        const funding = await fetchFunding();
        const tokenAddress = funding.sourceTokenAddress as `0x${string}`;

        const [allowance, balance] = await Promise.all([
          rpcClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, PERMIT2_ADDRESS as `0x${string}`],
          }),
          rpcClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
        ]);

        if (!cancelled) {
          setInsufficientBalance(balance < funding.sourceAmount);
          setSteps((prev) => ({
            ...prev,
            approve: {
              status:
                allowance >= funding.sourceAmount ? "completed" : "pending",
            },
          }));
        }
      } catch (err) {
        console.error("Failed to check allowance:", err);
        if (!cancelled) {
          setSteps((prev) => ({
            ...prev,
            approve: { status: "pending" },
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, rpcClient, chain, currentChainId, fetchFunding]);

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

  const runFromStep = async (startFrom: StepKey) => {
    if (!address) {
      open().catch(console.error);
      return;
    }
    if (!walletClient || !rpcClient) {
      open().catch(console.error);
      return;
    }
    if (!switchChainAsync || !chain) {
      return;
    }

    const updateStep = (key: string, state: StepState) => {
      setSteps((prev) => ({ ...prev, [key]: state }));
    };

    setIsRunning(true);
    setUserRejected(null);

    const stepOrder: StepKey[] = ["switchChain", "approve", "fund"];
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
          const tokenAddress = funding.sourceTokenAddress as `0x${string}`;
          const permit2 = PERMIT2_ADDRESS as `0x${string}`;
          console.log(
            `[approve] tokenAddress:`,
            tokenAddress,
            "spender (Permit2):",
            permit2,
          );

          // Check if allowance to Permit2 is already sufficient
          const allowance = await rpcClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, permit2],
          });
          console.log(
            `[approve] current allowance:`,
            allowance.toString(),
            "required:",
            funding.sourceAmount.toString(),
          );

          if (allowance >= funding.sourceAmount) {
            updateStep(step, { status: "completed" });
          } else {
            console.log(
              `[approve] sending approve tx (source token → Permit2)…`,
              "walletClient chain:",
              walletClient.chain?.id,
              "expected:",
              chain?.id,
            );
            // Approve max uint256 to Permit2 (one-time)
            const maxUint256 = BigInt(
              "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            );
            const approveData = `0x095ea7b3${permit2.slice(2).toLowerCase().padStart(64, "0")}${maxUint256.toString(16).padStart(64, "0")}`;
            const approveTxHash = await walletClient.sendTransaction({
              to: tokenAddress,
              data: approveData as `0x${string}`,
              chain,
              gas: 100_000n,
            });
            console.log(`[approve] tx hash:`, approveTxHash);
            const approveReceipt = await pollForReceipt(
              rpcClient,
              approveTxHash,
            );
            console.log(`[approve] receipt status:`, approveReceipt.status);
            if (approveReceipt.status !== "success") {
              const reason = await getRevertReason(
                rpcClient,
                approveTxHash,
                approveReceipt.blockNumber,
              );
              console.log(`[approve] revert reason:`, reason);
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

          // 1. Sign the Permit2 EIP-712 typed data with the user's wallet
          console.log("[fund] signing Permit2 typed data…");
          const typedData = freshFunding.typedData;
          const signature = await walletClient.signTypedData({
            domain: {
              ...typedData.domain,
              verifyingContract: typedData.domain
                .verifyingContract as `0x${string}`,
            },
            types: typedData.types,
            primaryType: typedData.primaryType,
            message: {
              permitted: {
                token: typedData.message.permitted.token as `0x${string}`,
                amount: typedData.message.permitted.amount,
              },
              spender: typedData.message.spender as `0x${string}`,
              nonce: typedData.message.nonce,
              deadline: typedData.message.deadline,
              witness: {
                preimageHash: typedData.message.witness
                  .preimageHash as `0x${string}`,
                token: typedData.message.witness.token as `0x${string}`,
                claimAddress: typedData.message.witness
                  .claimAddress as `0x${string}`,
                refundAddress: typedData.message.witness
                  .refundAddress as `0x${string}`,
                timelock: typedData.message.witness.timelock,
                callsHash: typedData.message.witness.callsHash as `0x${string}`,
              },
            },
            account: walletClient.account,
          });
          console.log("[fund] Permit2 signature:", signature);

          // 2. Encode executeAndCreateWithPermit2 calldata
          const encoded = encodeExecuteAndCreateWithPermit2(
            freshFunding.coordinatorAddress,
            {
              calls: freshFunding.calls,
              preimageHash: freshFunding.preimageHash,
              token: freshFunding.lockTokenAddress,
              claimAddress: freshFunding.claimAddress,
              timelock: freshFunding.timelock,
              depositor: address,
              sourceToken: freshFunding.sourceTokenAddress,
              sourceAmount: freshFunding.sourceAmount,
              nonce: freshFunding.nonce,
              deadline: freshFunding.deadline,
              signature,
            },
          );
          console.log("[fund] encoded calldata, sending tx…");

          // 3. Send the transaction
          const executeTxHash = await walletClient.sendTransaction({
            to: encoded.to as `0x${string}`,
            data: encoded.data as `0x${string}`,
            chain,
            gas: 500_000n,
          });
          const executeReceipt = await pollForReceipt(rpcClient, executeTxHash);
          if (executeReceipt.status !== "success") {
            const reason = await getRevertReason(
              rpcClient,
              executeTxHash,
              executeReceipt.blockNumber,
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
      const rawMsg = err instanceof Error ? err.message : "Transaction failed";
      const isUserRejection =
        /user rejected|user denied|rejected the request/i.test(rawMsg);

      // Mark the currently active step as errored
      const activeStep = stepOrder.find(
        (s) => steps[s]?.status === "active" || s === stepOrder[startIndex],
      );
      if (activeStep) {
        updateStep(activeStep, {
          status: isUserRejection ? "pending" : "error",
          error: isUserRejection ? undefined : rawMsg,
        });
        if (isUserRejection) {
          setUserRejected(activeStep);
        }
      }
    } finally {
      setIsRunning(false);
    }
  };

  const chainLabel = chain?.name ?? toChainName(swapData.source_token.chain);

  const stepDefs: StepDef[] = [
    { key: "switchChain", label: `Switch to ${chainLabel}`, action: "Switch" },
    {
      key: "approve",
      label: `Approve ${tokenSymbol} spend`,
      action: "Approve",
    },
    { key: "fund", label: "Fund swap", action: "Fund" },
  ];

  // The current step is the first non-completed step
  const currentStepKey = stepDefs.find(
    (s) => steps[s.key].status !== "completed",
  )?.key;

  return (
    <DepositCard
      sourceToken={swapData.source_token}
      targetToken={swapData.target_token}
      swapId={swapId}
      title={`${tokenSymbol} → ${swapData.target_token.symbol}`}
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

      {/* Expiry warning */}
      {isExpired ? (
        <div className="rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          This swap has expired. Funding is no longer possible.
        </div>
      ) : timeRemaining ? (
        <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            Time remaining to fund:{" "}
            <span className="font-mono font-medium">{timeRemaining}</span>
          </span>
        </div>
      ) : null}

      {/* Insufficient balance warning */}
      {insufficientBalance && !isExpired && (
        <div className="rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Insufficient {tokenSymbol} balance. You need at least {sourceAmount}{" "}
          {tokenSymbol} to fund this swap.
        </div>
      )}

      {/* Step checklist */}
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Your wallet approves and submits all transactions directly.
        </p>
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
                {step.status === "error" && !isExpired && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => runFromStep(key)}
                    disabled={isRunning || insufficientBalance}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
                {key === currentStepKey &&
                  step.status === "pending" &&
                  !isExpired && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 text-xs"
                      onClick={() => runFromStep(key)}
                      disabled={isRunning || insufficientBalance}
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
              <div key={`${key}-error`} className="ml-7">
                <SupportErrorBanner
                  message={`${key === "approve" ? "Token approval" : key === "fund" ? "Funding transaction" : "Transaction"} failed`}
                  error={step.error}
                  swapId={swapId}
                />
              </div>
            );
          })}
          {userRejected && (
            <div className="ml-7 rounded-lg border border-orange-500 bg-orange-50 p-2 text-xs text-orange-600 dark:bg-orange-950/20">
              You rejected the{" "}
              {userRejected === "approve"
                ? "token approval"
                : userRejected === "fund"
                  ? "funding transaction"
                  : "request"}{" "}
              in your wallet. Click the button above to try again.
            </div>
          )}
        </div>
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
            onClick={() => open().catch(console.error)}
            className="h-12 w-full text-base font-semibold"
          >
            Connect Wallet
          </Button>
        ) : currentStepKey && !isExpired ? (
          <Button
            onClick={() => runFromStep(currentStepKey)}
            disabled={isRunning || insufficientBalance}
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
