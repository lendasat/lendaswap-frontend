import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAccount } from "wagmi";
import {
  BTC_ARKADE_INFO,
  isArkade,
  isBtc,
  isBtcOnchain,
  isEvmToken,
  type TokenInfo,
} from "@lendasat/lendaswap-sdk-pure";
import { ArrowDown } from "lucide-react";
import { api } from "./api";
import { AmountInput } from "./components/AmountInput";
import { AssetDropDown } from "./components/AssetDropDown";
import { useAsync } from "react-use";
import { formatTokenUrl, parseUrlToken } from "./utils/tokenUtils";

// Build query string from amounts
function buildAmountParams(srcAmt?: number, tgtAmt?: number): string {
  const params = new URLSearchParams();
  if (srcAmt != null) params.set("sourceAmount", String(srcAmt));
  if (tgtAmt != null) params.set("targetAmount", String(tgtAmt));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function HomePage() {
  const navigate = useNavigate();
  const params = useParams<{ sourceToken?: string; targetToken?: string }>();
  const {
    address: _connectedAddress,
    isConnected: _isWeb3WalletConnected,
    chain: _web3WalletConnectedChain,
  } = useAccount();

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
  const [_lastEditedField, setLastEditedField] = useState<
    "sourceAsset" | "targetAsset"
  >("sourceAsset");

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
      t.chain === urlSourceToken?.chain &&
      t.token_id === urlSourceToken?.tokenId,
  );
  const targetAsset = allAvailableTokens.find(
    (t) =>
      t.chain === urlTargetToken?.chain &&
      t.token_id === urlTargetToken?.tokenId,
  );

  // Debounced sync of amounts to URL (avoids navigating on every keystroke)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!params.sourceToken || !params.targetToken) return;
      const path = `/${params.sourceToken}/${params.targetToken}`;
      navigate(`${path}${buildAmountParams(sourceAmount, targetAmount)}`, {
        replace: true,
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [sourceAmount, targetAmount, params, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default fallback tokens for auto-correction
  const defaultEvmToken = allAvailableTokens.find(
    (t) => t.token_id === "usdc_pol",
  );
  const defaultBtcToken = allAvailableTokens.find(
    (t) => t.token_id === BTC_ARKADE_INFO.token_id,
  );

  // Navigate to a new source/target token pair (URL is the source of truth)
  function navigateToTokens(
    source: TokenInfo,
    target: TokenInfo,
    srcAmt?: number,
    tgtAmt?: number,
  ) {
    const path = `/${formatTokenUrl(source)}/${formatTokenUrl(target)}`;
    navigate(
      `${path}${buildAmountParams(srcAmt ?? sourceAmount, tgtAmt ?? targetAmount)}`,
      {
        replace: true,
      },
    );
  }

  const isInitialLoading = tokensLoading;

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
                  // Special case: btc_onchain can be swapped to btc_arkade or EVM tokens
                  if (isBtcOnchain(asset)) {
                    const validTarget =
                      targetAsset &&
                      (isArkade(targetAsset) || isEvmToken(targetAsset.chain));
                    const newTarget = validTarget
                      ? targetAsset
                      : (defaultEvmToken ?? asset);
                    navigateToTokens(asset, newTarget);
                    return;
                  }

                  const isEvmAsset = isEvmToken(asset.chain);
                  const isBtcAsset = isBtc(asset);
                  const isEvmTarget = targetAsset
                    ? isEvmToken(targetAsset.chain)
                    : false;
                  const isBtcTarget = targetAsset ? isBtc(targetAsset) : false;

                  if (
                    targetAsset &&
                    ((isEvmAsset && isBtcTarget) || (isBtcAsset && isEvmTarget))
                  ) {
                    navigateToTokens(asset, targetAsset);
                    return;
                  }

                  // EVM source + EVM target = invalid, switch target to BTC
                  if (isEvmAsset && isEvmTarget) {
                    navigateToTokens(asset, defaultBtcToken ?? BTC_ARKADE_INFO);
                    return;
                  }

                  // BTC source + BTC target = invalid, switch target to default stablecoin
                  if (isBtcAsset && isBtcTarget && defaultEvmToken) {
                    navigateToTokens(asset, defaultEvmToken);
                    return;
                  }

                  // Fallback: just update source, keep target if available
                  if (targetAsset) {
                    navigateToTokens(asset, targetAsset);
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
                availableAssets={allAvailableTokens}
                value={targetAsset}
                onChange={(asset) => {
                  if (!sourceAsset) return;

                  // Special case: when source is btc_onchain, allow btc_arkade or EVM tokens
                  if (isBtcOnchain(sourceAsset)) {
                    if (isArkade(asset) || isEvmToken(asset.chain)) {
                      navigateToTokens(sourceAsset, asset);
                    }
                    return;
                  }

                  // Check if new target is compatible with current source
                  const isBtcTarget = isBtc(asset);
                  const isBtcSource = isBtc(sourceAsset);
                  const isEvmTarget = isEvmToken(asset.chain);
                  const isEvmSource = isEvmToken(sourceAsset.chain);

                  // If both are BTC, auto-switch source to EVM
                  if (isBtcTarget && isBtcSource && defaultEvmToken) {
                    navigateToTokens(defaultEvmToken, asset);
                    return;
                  }

                  // If both are EVM, auto-switch source to BTC
                  if (isEvmTarget && isEvmSource) {
                    navigateToTokens(defaultBtcToken ?? BTC_ARKADE_INFO, asset);
                    return;
                  }

                  // Compatible pair, just update target
                  navigateToTokens(sourceAsset, asset);
                }}
                label="buy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Address Input */}
      {/*
      <div className="pt-3">
        <AddressInput
          value={targetAddress}
          onChange={setTargetAddress}
          targetToken={targetAsset}
          setAddressIsValid={setAddressValid}
          setBitcoinAmount={(amount) => {
            setLastEditedField("targetAsset");
            setTargetAmountState(amount);
          }}
          disabled={
            isEmbedded && !!arkAddress && !!targetAsset && isArkade(targetAsset)
          }
        />

         Fees - below inputs, above Continue button
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
            {sourceAsset && isEvmToken(sourceAsset.chain) && isConnected && (
              <div>Gas Fee: check in wallet when signing</div>
            )}
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
            {sourceAsset && isEvmToken(sourceAsset.chain) && isConnected && (
              <div>Gas Fee: check in wallet when signing</div>
            )}
          </div>
        ) : null}

        <div className="pt-2">
           Show Connect Wallet button when:
              1. EVM source (user needs to pay gas to send EVM tokens)
              2. BTC source + Ethereum target (user needs to pay gas to claim on Ethereum)
              Note: BTC → Polygon uses Gelato Relay so no wallet needed
          {!isValidSpeedWalletContext() &&
          !isConnected &&
          ((sourceAsset && isEvmToken(sourceAsset.chain)) ||
            (sourceAsset &&
              isBtc(sourceAsset) &&
              targetAsset &&
              isEthereumToken(targetAsset.chain))) ? (
            <ConnectKitButton.Custom>
              {({ show }) => (
                <Button onClick={show} className="w-full h-12 gap-2">
                  <Wallet className="h-4 w-4" />
                  Connect Wallet to Pay Gas
                </Button>
              )}
            </ConnectKitButton.Custom>
          ) : (
            <Button
              onClick={handleContinueToFund}
              disabled={
                !targetAddress ||
                !addressValid ||
                isCreatingSwap ||
                isWrongChain ||
                (sourceAsset &&
                  isEvmToken(sourceAsset.chain) &&
                  !isEvmAddressValid)
              }
              className="w-full h-12"
            >
              {isCreatingSwap ? (
                <>
                  <Loader className="animate-spin h-4 w-4" />
                  Please Wait
                </>
              ) : isWrongChain ? (
                <>
                  <Loader className="animate-spin h-4 w-4" />
                  Switching to {expectedChain?.name}...
                </>
              ) : (
                <>Continue</>
              )}
            </Button>
          )}
        </div>

         Swap Error Display
        {swapError && (
          <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl border p-3 text-sm">
            {swapError}
          </div>
        )}
      </div>
*/}
    </div>
  );
}
