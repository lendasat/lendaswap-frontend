import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAccount } from "wagmi";
import {
  isArkade,
  isBtc,
  isBtcOnchain,
  type TokenInfo,
} from "@lendasat/lendaswap-sdk-pure";
import { ArrowDown } from "lucide-react";
import { api, type QuoteResponse } from "./api";
import { AmountInput } from "./components/AmountInput";
import { AssetDropDown } from "./components/AssetDropDown";
import { useAsync } from "react-use";
import { formatTokenUrl, isEvmToken, parseUrlToken } from "./utils/tokenUtils";
import { AddressInput } from "./components/AddressInput";
import { useWalletBridge } from "./WalletBridgeContext";
import { Skeleton } from "#/components/ui/skeleton";

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

// Valid targets for a given source:
//  - BTC onchain → Arkade + all EVM tokens
//  - BTC (arkade/lightning) → all EVM tokens
//  - EVM token → all BTC tokens (except onchain)
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

  if (isBtc(sourceAsset)) {
    return sort([...evmTokens]);
  }

  if (isEvmToken(sourceAsset.chain)) {
    // EVM → BTC (arkade, lightning); not onchain
    return sort([...btcTokens]);
  }

  // fallback: all BTC tokens
  return sort([...allTokens]);
}

export function HomePage() {
  const navigate = useNavigate();
  const params = useParams<{ sourceToken?: string; targetToken?: string }>();
  const {
    address: connectedAddress,
    isConnected: isWeb3WalletConnected,
    chain: _web3WalletConnectedChain,
  } = useAccount();

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

  const [lastEditedField, setLastEditedField] = useState<
    "sourceAsset" | "targetAsset"
  >("sourceAsset");
  const [targetAddress, setTargetAddress] = useState<string>(
    () => searchParams.get("address") ?? "",
  );
  const [isAddressValid, setIsAddressValid] = useState(true);

  // Sync targetAddress from URL when search params change (e.g. user edits URL bar)
  const urlAddress = searchParams.get("address");
  useEffect(() => {
    if (urlAddress != null && urlAddress !== targetAddress) {
      setTargetAddress(urlAddress);
    }
  }, [urlAddress, targetAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill from connected wallet only if address is empty
  useEffect(() => {
    const maybeWeb3Address = connectedAddress?.toString();
    if (maybeWeb3Address && isWeb3WalletConnected && !targetAddress) {
      setTargetAddress(maybeWeb3Address);
    } else if (!isWeb3WalletConnected && targetAddress === connectedAddress) {
      setTargetAddress("");
    }
  }, [connectedAddress, isWeb3WalletConnected, targetAddress]);

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
      t.token_id.toLowerCase() === urlSourceToken?.tokenId.toLowerCase(),
  );
  const targetAsset = allAvailableTokens.find(
    (t) =>
      t.chain.toLowerCase() === urlTargetToken?.chain.toLowerCase() &&
      t.token_id.toLowerCase() === urlTargetToken?.tokenId.toLowerCase(),
  );

  const availableTargetTokens = getAvailableTargetAssets(
    maybeAvailableTokens?.btc_tokens || [],
    maybeAvailableTokens?.evm_tokens || [],
    allAvailableTokens,
    sourceAsset,
  );

  // Fetch a baseline quote whenever the asset pair changes (1000 source units)
  const [quote, setQuote] = useState<QuoteResponse | undefined>();
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  const sourceTokenId = sourceAsset?.token_id;
  const sourceChain = sourceAsset?.chain;
  const sourceDecimals = sourceAsset?.decimals;
  const isSourceBtc = sourceAsset ? isBtc(sourceAsset) : false;
  const targetTokenId = targetAsset?.token_id;
  const targetChain = targetAsset?.chain;

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

  // Compute the counterpart amount from the quote rate
  // When source is edited → derive target; when target is edited → derive source
  // Default: derive target from source
  useEffect(() => {
    if (
      !quote ||
      lastEditedField !== "sourceAsset" ||
      sourceAmount === undefined
    ) {
      return;
    }
    const qSrc = Number(quote.source_amount);
    const qTgt = Number(quote.target_amount);
    if (qSrc === 0) return;
    const rate = qTgt / qSrc;
    setTargetAmountState(Math.round(sourceAmount * rate));
  }, [sourceAmount, quote, lastEditedField]);

  useEffect(() => {
    if (
      !quote ||
      lastEditedField !== "targetAsset" ||
      targetAmount === undefined
    ) {
      return;
    }
    const qSrc = Number(quote.source_amount);
    const qTgt = Number(quote.target_amount);
    if (qTgt === 0) return;
    const rate = qSrc / qTgt;
    setSourceAmountState(Math.round(targetAmount * rate));
  }, [targetAmount, quote, lastEditedField]);

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
  ) {
    const path = `/${formatTokenUrl(source)}/${formatTokenUrl(target)}`;
    navigate(
      `${path}${buildQueryParams(srcAmt ?? sourceAmount, tgtAmt ?? targetAmount, targetAddress)}`,
      {
        replace: true,
      },
    );
  }

  const isInitialLoading = tokensLoading || isLoadingQuote;

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
              showCurrencyPrefix={true}
              // fixme: implement USD value
              usdPerToken={0}
              tokenSymbol={sourceAsset?.symbol}
            />
            <div className="shrink-0 pt-1">
              <AssetDropDown
                value={sourceAsset}
                availableAssets={allAvailableTokens}
                label="sell"
                onChange={(asset) => {
                  if (targetAsset) {
                    navigateToTokens(asset, targetAsset);
                  } else {
                    const src = formatTokenUrl(asset);
                    navigate(
                      `/${src}/polygon:0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`,
                      { replace: true },
                    );
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
            navigateToTokens(
              targetAsset,
              sourceAsset,
              targetAmount,
              sourceAmount,
            );
          }}
          disabled={!sourceAsset || isBtcOnchain(sourceAsset)}
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
              showCurrencyPrefix={true}
              // fixme: implement USD value and loading state
              usdPerToken={0}
              tokenSymbol={targetAsset?.symbol}
            />
            <div className="shrink-0 pt-1">
              <AssetDropDown
                availableAssets={availableTargetTokens}
                value={targetAsset}
                onChange={(asset) => {
                  if (sourceAsset) {
                    navigateToTokens(sourceAsset, asset);
                  } else {
                    const target = formatTokenUrl(asset);
                    navigate(`/lightning:btc/${target}`, { replace: true });
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
        {isLoadingQuote ? (
          <div className="text-xs text-muted-foreground/70 pt-2 space-y-1">
            <div className="flex flex-wrap justify-between gap-y-0.5">
              <div className="flex items-center gap-1">
                Network Fee: <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex items-center gap-1">
                Protocol Fee: <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ) : quote ? (
          <div className="text-xs text-muted-foreground/70 pt-2 space-y-1">
            <div className="flex flex-wrap justify-between gap-y-0.5">
              <div>
                Network Fee:{" "}
                {(Number(quote.network_fee) / 100_000_000.0).toFixed(8)} BTC
              </div>
              <div>
                Protocol Fee:{" "}
                {(Number(quote.protocol_fee) / 100_000_000.0).toFixed(8)} BTC (
                {(quote.protocol_fee_rate * 100).toFixed(2)}%)
              </div>
            </div>
          </div>
        ) : null}
        {/*<div className="pt-2">*/}
        {/*  Show Connect Wallet button when: 1. EVM source (user needs to pay gas*/}
        {/*  to send EVM tokens) 2. BTC source + Ethereum target (user needs to pay*/}
        {/*  gas to claim on Ethereum) Note: BTC → Polygon uses Gelato Relay so no*/}
        {/*  wallet needed*/}
        {/*  {!isValidSpeedWalletContext() &&*/}
        {/*  !isConnected &&*/}
        {/*  ((sourceAsset && isEvmToken(sourceAsset.chain)) ||*/}
        {/*    (sourceAsset &&*/}
        {/*      isBtc(sourceAsset) &&*/}
        {/*      targetAsset &&*/}
        {/*      isEthereumToken(targetAsset.chain))) ? (*/}
        {/*    <ConnectKitButton.Custom>*/}
        {/*      {({ show }) => (*/}
        {/*        <Button onClick={show} className="w-full h-12 gap-2">*/}
        {/*          <Wallet className="h-4 w-4" />*/}
        {/*          Connect Wallet to Pay Gas*/}
        {/*        </Button>*/}
        {/*      )}*/}
        {/*    </ConnectKitButton.Custom>*/}
        {/*  ) : (*/}
        {/*    <Button*/}
        {/*      onClick={handleContinueToFund}*/}
        {/*      disabled={*/}
        {/*        !targetAddress ||*/}
        {/*        !addressValid ||*/}
        {/*        isCreatingSwap ||*/}
        {/*        isWrongChain ||*/}
        {/*        (sourceAsset &&*/}
        {/*          isEvmToken(sourceAsset.chain) &&*/}
        {/*          !isEvmAddressValid)*/}
        {/*      }*/}
        {/*      className="w-full h-12"*/}
        {/*    >*/}
        {/*      {isCreatingSwap ? (*/}
        {/*        <>*/}
        {/*          <Loader className="animate-spin h-4 w-4" />*/}
        {/*          Please Wait*/}
        {/*        </>*/}
        {/*      ) : isWrongChain ? (*/}
        {/*        <>*/}
        {/*          <Loader className="animate-spin h-4 w-4" />*/}
        {/*          Switching to {expectedChain?.name}...*/}
        {/*        </>*/}
        {/*      ) : (*/}
        {/*        <>Continue</>*/}
        {/*      )}*/}
        {/*    </Button>*/}
        {/*  )}*/}
        {/*</div>*/}
        {/*Swap Error Display*/}
        {/*{swapError && (*/}
        {/*  <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl border p-3 text-sm">*/}
        {/*    {swapError}*/}
        {/*  </div>*/}
        {/*)}*/}
      </div>
    </div>
  );
}
