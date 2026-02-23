import {
  isArkade,
  isBtc,
  isBtcOnchain,
  type TokenInfo,
  toChainName,
} from "@lendasat/lendaswap-sdk-pure";
import { useModal } from "connectkit";
import { ArrowDown, ChevronDown, Loader } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAsync } from "react-use";
import { useAccount, useSwitchChain } from "wagmi";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { api, type QuoteResponse } from "./api";
import { AddressInput } from "./components/AddressInput";
import { AmountInput } from "./components/AmountInput";
import { AssetDropDown } from "./components/AssetDropDown";
import {
  deriveSourceAmount,
  deriveTargetAmount,
  evmSmallestToSats,
  extractFees,
  gaslessFeeBtc,
  protocolFeeBtc,
  serverNetworkFeeBtc,
  totalFeeBtc,
} from "./utils/quoteUtils";
import { setReferralCode, validateReferralCode } from "./utils/referralCode";
import { formatTokenUrl, isEvmToken, parseUrlToken } from "./utils/tokenUtils";
import { useWalletBridge } from "./WalletBridgeContext";

// Build query string from amounts and target address
function buildQueryParams(
  srcAmt?: number,
  tgtAmt?: number,
  address?: string,
): string {
  const params = new URLSearchParams();
  if (srcAmt != null) params.set("sourceAmount", String(srcAmt));
  if (tgtAmt != null) params.set("targetAmount", String(tgtAmt));
  if (address) params.set("address", address);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

const DEFAULT_USDC_POLYGON = "polygon:USDC";
const DEFAULT_BTC_LIGHTNING = "lightning:BTC";

/** Check if a source→target pair is a valid swap direction */
function isValidPair(source: TokenInfo, target: TokenInfo): boolean {
  // EVM → EVM: not allowed
  if (isEvmToken(source.chain) && isEvmToken(target.chain)) return false;
  // BTC → BTC: only onchain → arkade is allowed
  if (isBtc(source) && isBtc(target)) {
    return isBtcOnchain(source) && isArkade(target);
  }
  return true;
}

// Valid targets for a given source:
//  - BTC onchain → Arkade + all EVM tokens
//  - BTC (arkade/lightning) → all EVM tokens
//  - EVM token → all BTC tokens
function getAvailableTargetAssets(
  btcTokens: TokenInfo[],
  evmTokens: TokenInfo[],
  allTokens: TokenInfo[],
  sourceAsset?: TokenInfo,
): TokenInfo[] {
  const sort = (list: TokenInfo[]) =>
    list.sort((a, b) => a.symbol.localeCompare(b.symbol));

  if (!sourceAsset) {
    return sort([...allTokens]);
  }

  if (isBtcOnchain(sourceAsset)) {
    // Onchain BTC → EVM tokens + Arkade
    const arkadeTokens = btcTokens.filter((t) => isArkade(t));
    return sort([...evmTokens, ...arkadeTokens]);
  }

  if (isBtc(sourceAsset)) {
    // Other BTC (lightning, arkade) → EVM tokens only
    return sort([...evmTokens]);
  }

  if (isEvmToken(sourceAsset.chain)) {
    return sort([...btcTokens]);
  }

  return sort([...allTokens]);
}

export function HomePage() {
  const navigate = useNavigate();
  const params = useParams<{ sourceToken?: string; targetToken?: string }>();
  const {
    address: connectedAddress,
    isConnected: isWeb3WalletConnected,
    chain: web3WalletConnectedChain,
  } = useAccount();

  const { switchChain } = useSwitchChain();
  const { setOpen: openConnectModal } = useModal();
  const { arkAddress, isEmbedded } = useWalletBridge();

  useEffect(() => {
    document.title = "LendaSwap - Lightning-Fast Bitcoin Atomic Swaps";
  }, []);

  // Parse URL params like "lightning:btc" or "polygon:0x1234" into {chain, address}
  const urlSourceToken = params.sourceToken
    ? parseUrlToken(params.sourceToken)
    : undefined;
  const urlTargetToken = params.targetToken
    ? parseUrlToken(params.targetToken)
    : undefined;

  const [searchParams] = useSearchParams();

  // Initialize amounts from URL search params (e.g. ?sourceAmount=100&targetAmount=0.005)
  const [sourceAmount, setSourceAmountState] = useState<number | undefined>(
    () => {
      const v = searchParams.get("sourceAmount");
      return v ? Number(v) : undefined;
    },
  );
  const [targetAmount, setTargetAmountState] = useState<number | undefined>(
    () => {
      const v = searchParams.get("targetAmount");
      return v ? Number(v) : undefined;
    },
  );
  const [isCreatingSwap, setIsCreatingSwap] = useState(false);

  const [lastEditedField, setLastEditedField] = useState<
    "sourceAsset" | "targetAsset"
  >("sourceAsset");
  const [targetAddress, setTargetAddress] = useState<string>(
    () => searchParams.get("address") ?? "",
  );
  const [isAddressValid, setIsAddressValid] = useState(true);
  const [swapError, setSwapError] = useState("");

  // Sync targetAddress from URL when search params change (e.g. user edits URL bar)
  const urlAddress = searchParams.get("address");
  useEffect(() => {
    if (urlAddress != null) {
      setTargetAddress(urlAddress);
    }
  }, [urlAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist referral code from URL (?ref=...) to localStorage
  const urlRef = searchParams.get("ref");
  useEffect(() => {
    if (urlRef && validateReferralCode(urlRef)) {
      setReferralCode(urlRef);
    }
  }, [urlRef]);

  const {
    value: maybeAvailableTokens,
    loading: tokensLoading,
    error: tokensLoadingError,
  } = useAsync(async () => {
    return api.getTokens();
  });

  if (tokensLoadingError) {
    console.error(tokensLoadingError);
  }

  const allAvailableTokens = useMemo(() => {
    const btc = maybeAvailableTokens?.btc_tokens || [];
    const evm = maybeAvailableTokens?.evm_tokens || [];
    return [...btc, ...evm];
  }, [maybeAvailableTokens]);

  const sourceAsset = allAvailableTokens.find(
    (t) =>
      t.chain.toLowerCase() === urlSourceToken?.chain.toLowerCase() &&
      t.symbol.toLowerCase() === urlSourceToken?.symbol.toLowerCase(),
  );
  const targetAsset = allAvailableTokens.find(
    (t) =>
      t.chain.toLowerCase() === urlTargetToken?.chain.toLowerCase() &&
      t.symbol.toLowerCase() === urlTargetToken?.symbol.toLowerCase(),
  );

  // Auto-fill from connected wallet only when target is an EVM token
  const isEvmTarget = targetAsset ? isEvmToken(targetAsset.chain) : false;
  useEffect(() => {
    const maybeWeb3Address = connectedAddress?.toString();
    if (
      maybeWeb3Address &&
      isWeb3WalletConnected &&
      isEvmTarget &&
      !targetAddress
    ) {
      setTargetAddress(maybeWeb3Address);
    } else if (!isWeb3WalletConnected && targetAddress === connectedAddress) {
      setTargetAddress("");
    }
    // Note: targetAddress intentionally excluded to avoid re-filling after user clears it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAddress, isWeb3WalletConnected, isEvmTarget, targetAddress]);

  const availableTargetTokens = getAvailableTargetAssets(
    maybeAvailableTokens?.btc_tokens || [],
    maybeAvailableTokens?.evm_tokens || [],
    allAvailableTokens,
    sourceAsset,
  );

  // Fetch USD prices once tokens are loaded (dep is the raw API result for
  // referential stability — it only changes once: undefined → data)
  const { value: usdPrices } = useAsync(async () => {
    if (!maybeAvailableTokens) return new Map<string, number>();
    const tokens = [
      ...maybeAvailableTokens.btc_tokens,
      ...maybeAvailableTokens.evm_tokens,
    ];
    return api.getTokenUsdPrices(tokens);
  }, [maybeAvailableTokens]);

  const getUsdPrice = (token: TokenInfo) =>
    usdPrices?.get(`${token.chain}:${token.symbol}`) ?? 0;
  const sourceUsdPerToken = sourceAsset ? getUsdPrice(sourceAsset) : 0;
  const targetUsdPerToken = targetAsset ? getUsdPrice(targetAsset) : 0;

  // Fetch a baseline quote whenever the asset pair changes (1000 source units)
  const [quote, setQuote] = useState<QuoteResponse | undefined>();
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [feeExpanded, setFeeExpanded] = useState(false);

  const sourceTokenId = sourceAsset?.token_id;
  const sourceChain = sourceAsset?.chain;
  const sourceDecimals = sourceAsset?.decimals;
  const isSourceBtc = sourceAsset ? isBtc(sourceAsset) : false;
  const targetTokenId = targetAsset?.token_id;
  const targetChain = targetAsset?.chain;
  const targetDecimals = targetAsset?.decimals;

  useEffect(() => {
    if (!sourceTokenId || !sourceChain || !targetTokenId || !targetChain) {
      setQuote(undefined);
      return;
    }

    // BTC: 0.1 BTC = 10_000_000 sats; everything else: 1 display unit (e.g. 1_000_000 for USDC)
    const quoteAmount = isSourceBtc ? 10_000_000 : 10 ** (sourceDecimals ?? 0);

    setIsLoadingQuote(true);
    const aborted = { current: false };

    api
      .getQuote({
        sourceChain,
        sourceToken: sourceTokenId,
        targetChain,
        targetToken: targetTokenId,
        sourceAmount: quoteAmount,
      })
      .then((q) => {
        if (!aborted.current) setQuote(q);
      })
      .catch((err) => {
        if (!aborted.current) {
          console.error("Quote fetch failed:", err);
          setQuote(undefined);
        }
      })
      .finally(() => {
        if (!aborted.current) setIsLoadingQuote(false);
      });

    return () => {
      aborted.current = true;
    };
  }, [
    sourceTokenId,
    sourceChain,
    targetTokenId,
    targetChain,
    isSourceBtc,
    sourceDecimals,
  ]);

  // Source edited → derive target (fees deducted from target side)
  useEffect(() => {
    if (
      !quote ||
      lastEditedField !== "sourceAsset" ||
      sourceAmount === undefined
    ) {
      return;
    }
    const exchangeRate = Number(quote.exchange_rate);
    if (exchangeRate === 0) return;
    const evmDecimals = (isSourceBtc ? targetDecimals : sourceDecimals) ?? 0;
    setTargetAmountState(
      deriveTargetAmount({
        amount: sourceAmount,
        exchangeRate,
        evmDecimals,
        isSourceBtc,
        fees: extractFees(quote),
      }),
    );
  }, [
    sourceAmount,
    quote,
    lastEditedField,
    isSourceBtc,
    sourceDecimals,
    targetDecimals,
  ]);

  // Target edited → derive source (fees added to source side)
  useEffect(() => {
    if (
      !quote ||
      lastEditedField !== "targetAsset" ||
      targetAmount === undefined
    ) {
      return;
    }
    const exchangeRate = Number(quote.exchange_rate);
    if (exchangeRate === 0) return;
    const evmDecimals = (isSourceBtc ? targetDecimals : sourceDecimals) ?? 0;
    setSourceAmountState(
      deriveSourceAmount({
        amount: targetAmount,
        exchangeRate,
        evmDecimals,
        isSourceBtc,
        fees: extractFees(quote),
      }),
    );
  }, [
    targetAmount,
    quote,
    lastEditedField,
    isSourceBtc,
    sourceDecimals,
    targetDecimals,
  ]);

  // Debounced sync of amounts + address to URL (avoids navigating on every keystroke)
  const { sourceToken: urlSource, targetToken: urlTarget } = params;
  useEffect(() => {
    if (!urlSource || !urlTarget) return;
    const timeout = setTimeout(() => {
      const path = `/${urlSource}/${urlTarget}`;
      navigate(
        `${path}${buildQueryParams(sourceAmount, targetAmount, targetAddress)}`,
        { replace: true },
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [
    sourceAmount,
    targetAmount,
    targetAddress,
    urlSource,
    urlTarget,
    navigate,
  ]);

  // Navigate to a new source/target token pair (URL is the source of truth)
  function navigateToTokens(
    source: TokenInfo,
    target: TokenInfo,
    srcAmt?: number,
    tgtAmt?: number,
    address?: string,
  ) {
    const path = `/${formatTokenUrl(source)}/${formatTokenUrl(target)}`;
    navigate(
      `${path}${buildQueryParams(srcAmt ?? sourceAmount, tgtAmt ?? targetAmount, address ?? targetAddress)}`,
      {
        replace: true,
      },
    );
  }

  const isInitialLoading = tokensLoading;

  // The required EVM chain is whichever side (source or target) is an EVM token
  const requiredEvmChain =
    sourceAsset && isEvmToken(sourceAsset.chain)
      ? sourceAsset.chain
      : targetAsset && isEvmToken(targetAsset.chain)
        ? targetAsset.chain
        : undefined;

  const isWrongChain =
    requiredEvmChain !== undefined &&
    web3WalletConnectedChain !== undefined &&
    requiredEvmChain !== web3WalletConnectedChain.id.toString();

  const createSwap = async () => {
    if (!sourceAsset || !targetAsset) {
      return;
    }
    try {
      setIsCreatingSwap(true);

      let selectedSourceAmount: number | undefined;
      let selectedTargetAmount: number | undefined;
      if (lastEditedField === "sourceAsset") {
        selectedSourceAmount = sourceAmount;
      } else {
        selectedTargetAmount = targetAmount;
      }

      const swap = await api.createSwap({
        sourceAsset,
        targetAsset,
        sourceAmount: selectedSourceAmount,
        targetAmount: selectedTargetAmount,
        targetAddress,
        userAddress: connectedAddress,
      });
      navigate(`/swap/${swap.id}/wizard`);
    } catch (e) {
      console.error(e);
      setSwapError(`${e}`);
    } finally {
      setIsCreatingSwap(false);
    }
  };

  const requiredChainName = requiredEvmChain && toChainName(requiredEvmChain);
  const isWeb3WalletNeeded = sourceAsset && isEvmToken(sourceAsset.chain);
  const isConnectionStillNeeded = isWeb3WalletNeeded && !isWeb3WalletConnected;

  // Compute the BTC-equivalent amount in sats for limit validation
  // Limits from the quote are always in sats
  const btcAmountSats = useMemo(() => {
    if (!quote) return undefined;
    if (isSourceBtc && sourceAmount != null) {
      return sourceAmount;
    }
    if (!isSourceBtc && targetAmount != null) {
      return targetAmount;
    }
    if (!isSourceBtc && sourceAmount != null) {
      const exchangeRate = Number(quote.exchange_rate);
      if (exchangeRate === 0) return undefined;
      return Math.round(
        evmSmallestToSats(sourceAmount, exchangeRate, sourceDecimals ?? 0),
      );
    }
    return undefined;
  }, [quote, sourceAmount, targetAmount, isSourceBtc, sourceDecimals]);

  const isBelowMin =
    quote != null &&
    btcAmountSats != null &&
    btcAmountSats < quote.min_amount &&
    btcAmountSats > 0;
  const isAboveMax =
    quote != null && btcAmountSats != null && btcAmountSats > quote.max_amount;
  const isOutOfLimits = isBelowMin || isAboveMax;

  // Skeleton loader for initial loading state
  if (isInitialLoading) {
    return (
      <div className="flex flex-col p-3 animate-pulse">
        {/* Sell skeleton */}
        <div className="rounded-2xl bg-muted p-4 pb-5">
          <div className="h-4 w-8 bg-muted-foreground/20 rounded mb-3" />
          <div className="flex items-center justify-between gap-4">
            <div className="h-10 flex-1 bg-muted-foreground/20 rounded-lg" />
            <div className="h-10 w-28 bg-muted-foreground/20 rounded-full" />
          </div>
        </div>
        {/* Arrow skeleton */}
        <div className="flex justify-center -my-3 relative z-10">
          <div className="w-10 h-10 bg-background rounded-xl p-1">
            <div className="w-full h-full bg-muted rounded-lg" />
          </div>
        </div>
        {/* Buy skeleton */}
        <div className="rounded-2xl bg-muted p-4 pt-5">
          <div className="h-4 w-8 bg-muted-foreground/20 rounded mb-3" />
          <div className="flex items-center justify-between gap-4">
            <div className="h-10 flex-1 bg-muted-foreground/20 rounded-lg" />
            <div className="h-10 w-28 bg-muted-foreground/20 rounded-full" />
          </div>
        </div>
        {/* Address skeleton */}
        <div className="mt-3 rounded-2xl bg-muted p-4">
          <div className="h-4 w-32 bg-muted-foreground/20 rounded mb-3" />
          <div className="h-12 w-full bg-muted-foreground/20 rounded-xl" />
        </div>
        {/* Button skeleton */}
        <div className="mt-3 h-14 w-full bg-muted-foreground/20 rounded-2xl" />
      </div>
    );
  }

  const buttonDisabled =
    !targetAddress ||
    !isAddressValid ||
    isCreatingSwap ||
    isOutOfLimits ||
    (!sourceAmount && !targetAmount);

  const gaslessFeeEstimate =
    quote && quote.gasless_network_fee > 0 && gaslessFeeBtc(quote);
  const totalFee = quote && totalFeeBtc(btcAmountSats, quote);
  const networkFee = quote && serverNetworkFeeBtc(quote);
  const protocolFee = quote && protocolFeeBtc(btcAmountSats, quote);

  return (
    <div className="flex flex-col p-3">
      {/* Sell/Buy container with arrow */}
      <div className="relative">
        {/* Sell */}
        <div className="rounded-2xl bg-muted p-4 pb-5 overflow-hidden">
          <div className="text-sm text-muted-foreground mb-2">Sell</div>
          <div className="flex items-start justify-between gap-4">
            <AmountInput
              value={sourceAmount}
              onChange={(value) => {
                setLastEditedField("sourceAsset");
                setSourceAmountState(value);
              }}
              decimals={sourceAsset?.decimals}
              isLoading={isLoadingQuote && lastEditedField !== "sourceAsset"}
              usdPerToken={sourceUsdPerToken}
              tokenSymbol={sourceAsset?.symbol}
            />
            <div className="shrink-0 pt-1">
              <AssetDropDown
                value={sourceAsset}
                availableAssets={allAvailableTokens}
                label="sell"
                onChange={(asset) => {
                  setSwapError("");
                  const src = formatTokenUrl(asset);
                  if (targetAsset && isValidPair(asset, targetAsset)) {
                    navigateToTokens(asset, targetAsset);
                  } else {
                    // Invalid pair or no target — pick a sensible default
                    const defaultTarget = isBtc(asset)
                      ? DEFAULT_USDC_POLYGON
                      : DEFAULT_BTC_LIGHTNING;
                    navigate(`/${src}/${defaultTarget}`, { replace: true });
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Swap button - absolutely positioned (like Uniswap) */}
        <button
          type="button"
          data-no-press
          onClick={() => {
            if (!sourceAsset || !targetAsset) return;
            // btc_onchain can only be in sell position, not buy position
            if (isBtcOnchain(sourceAsset)) return;

            // Swap source and target tokens + amounts
            setSourceAmountState(targetAmount);
            setTargetAmountState(sourceAmount);
            setTargetAddress("");
            navigateToTokens(
              targetAsset,
              sourceAsset,
              targetAmount,
              sourceAmount,
              "",
            );
          }}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 group/swap ${!sourceAsset || isBtcOnchain(sourceAsset) ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="bg-background rounded-xl p-1 transition-transform duration-200 ease-out group-hover/swap:scale-110 group-active/swap:scale-125">
            <div className="bg-muted rounded-lg p-1.5 transition-colors group-hover/swap:bg-muted/80">
              <ArrowDown className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </button>

        {/* Buy */}
        <div className="rounded-2xl bg-muted p-4 pt-5 mt-1 overflow-hidden">
          <div className="text-sm text-muted-foreground mb-2">Buy</div>
          <div className="flex items-start justify-between gap-4">
            <AmountInput
              value={targetAmount}
              onChange={(value) => {
                setLastEditedField("targetAsset");
                setTargetAmountState(value);
              }}
              decimals={targetAsset?.decimals ?? 8}
              isLoading={isLoadingQuote && lastEditedField !== "targetAsset"}
              usdPerToken={targetUsdPerToken}
              tokenSymbol={targetAsset?.symbol}
            />
            <div className="shrink-0 pt-1">
              <AssetDropDown
                availableAssets={availableTargetTokens}
                value={targetAsset}
                onChange={(asset) => {
                  setSwapError("");
                  const tgt = formatTokenUrl(asset);
                  if (sourceAsset && isValidPair(sourceAsset, asset)) {
                    navigateToTokens(sourceAsset, asset);
                  } else {
                    // Invalid pair or no source — pick a sensible default
                    const defaultSource = isBtc(asset)
                      ? DEFAULT_USDC_POLYGON
                      : DEFAULT_BTC_LIGHTNING;
                    navigate(`/${defaultSource}/${tgt}`, { replace: true });
                  }
                }}
                label="buy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Address Input */}

      <div className="pt-3">
        <AddressInput
          value={targetAddress}
          onChange={setTargetAddress}
          targetToken={targetAsset}
          setBitcoinAmount={(amount) => {
            setLastEditedField("targetAsset");
            setTargetAmountState(amount);
          }}
          setAddressIsValid={setIsAddressValid}
          disabled={
            isEmbedded && !!arkAddress && !!targetAsset && isArkade(targetAsset)
          }
        />
        {/*Fees - below inputs, above Continue button*/}
        {(isLoadingQuote || quote) && (
          <div className="text-xs text-muted-foreground/70 pt-2 space-y-1">
            {!isLoadingQuote && isBelowMin && (
              <div className="text-destructive">
                Amount too low — minimum is {quote.min_amount.toLocaleString()}{" "}
                sats
              </div>
            )}
            {!isLoadingQuote && isAboveMax && (
              <div className="text-destructive">
                Amount too high — maximum is {quote.max_amount.toLocaleString()}{" "}
                sats
              </div>
            )}
            <div className="space-y-1 flex flex-col items-end">
              <button
                type="button"
                className="flex items-center gap-0.5 hover:text-muted-foreground transition-colors"
                onClick={() => setFeeExpanded((v) => !v)}
              >
                Total Fee:{" "}
                {isLoadingQuote ? (
                  <Skeleton className="h-3 w-20 inline-block" />
                ) : (
                  <>{totalFee} BTC</>
                )}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${feeExpanded ? "rotate-180" : ""}`}
                />
              </button>
              {feeExpanded && (
                <div className="text-muted-foreground/50 space-y-0.5 text-right">
                  {isLoadingQuote ? (
                    <>
                      <Skeleton className="h-3 w-32 ml-auto" />
                      <Skeleton className="h-3 w-28 ml-auto" />
                    </>
                  ) : (
                    <>
                      <div>Network Fee: {networkFee} BTC</div>
                      {gaslessFeeEstimate && (
                        <div>Gasless Fee: {gaslessFeeEstimate} BTC</div>
                      )}
                      {quote && (
                        <div>
                          Protocol Fee (
                          {(quote.protocol_fee_rate * 100).toFixed(2)}
                          %): {protocolFee} BTC
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="pt-2">
          {isConnectionStillNeeded ? (
            <Button
              onClick={() => openConnectModal(true)}
              className="w-full h-12"
            >
              Connect Wallet
            </Button>
          ) : isWrongChain && requiredEvmChain ? (
            <Button
              onClick={() => switchChain({ chainId: Number(requiredEvmChain) })}
              className="w-full h-12"
            >
              Switch to {requiredChainName}
            </Button>
          ) : (
            <Button
              onClick={createSwap}
              disabled={buttonDisabled}
              className="w-full h-12"
            >
              {isCreatingSwap ? (
                <>
                  <Loader className="animate-spin h-4 w-4" />
                  Please Wait
                </>
              ) : (
                <>Continue</>
              )}
            </Button>
          )}
        </div>
        {/*Swap Error Display*/}
        {swapError && (
          <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl border p-3 text-sm">
            {swapError}
          </div>
        )}
      </div>
    </div>
  );
}
