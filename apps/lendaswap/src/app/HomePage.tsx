import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { usePostHog } from "posthog-js/react";
import { useAccount, useSwitchChain } from "wagmi";
import {
  BTC_ARKADE,
  BTC_LIGHTNING,
  isArkade,
  isBtc,
  isBtcOnchain,
  isEthereumToken,
  isEvmToken,
  isLightning,
  type TokenId,
} from "@lendasat/lendaswap-sdk-pure";
import { ConnectKitButton } from "connectkit";
import { ArrowDown, Loader, Wallet } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import {
  getSpeedLightningAddress,
  isValidSpeedWalletContext,
} from "../utils/speedWallet";
import { api, getTokenSymbol, type QuoteResponse } from "./api";
import { AddressInput } from "./components/AddressInput";
import { AmountInput } from "./components/AmountInput";
import { AssetDropDown } from "./components/AssetDropDown";
import { useCreateSwap } from "./hooks/useCreateSwap";
import { usePairs } from "./hooks/usePairs";
import {
  calculateSourceAmount,
  calculateTargetAmount,
  computeExchangeRate,
} from "./utils/priceUtils";
import { getViemChain, isValidTokenId } from "./utils/tokenUtils";
import { useWalletBridge } from "./WalletBridgeContext";

export function HomePage() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const params = useParams<{ sourceToken?: string; targetToken?: string }>();
  const {
    address: connectedAddress,
    isConnected,
    chain: connectedChain,
  } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    document.title = "LendaSwap - Lightning-Fast Bitcoin Atomic Swaps";
  }, []);

  // Read tokens from URL params, validate them
  const urlSourceToken = isValidTokenId(params.sourceToken)
    ? params.sourceToken
    : null;
  const urlTargetToken = isValidTokenId(params.targetToken)
    ? params.targetToken
    : null;

  // Redirect to default if invalid tokens in URL (skip for Speed Wallet to preserve params)
  useEffect(() => {
    if (!urlSourceToken || !urlTargetToken) {
      if (!isValidSpeedWalletContext()) {
        navigate("/btc_lightning/usdc_pol", { replace: true });
      }
    }
  }, [urlSourceToken, urlTargetToken, navigate]);

  // Check Speed Wallet context for defaults
  const isSpeedWalletUser = isValidSpeedWalletContext();

  const [sourceAssetAmount, setSourceAssetAmount] = useState<
    number | undefined
  >(undefined);
  const [sourceAsset, setSourceAsset] = useState<TokenId>(
    (urlSourceToken && (urlSourceToken as TokenId)) || "btc_arkade",
  );
  const [targetAsset, setTargetAsset] = useState<TokenId>(
    (urlTargetToken && (urlTargetToken as TokenId)) ||
      (isSpeedWalletUser ? BTC_LIGHTNING : BTC_ARKADE),
  );
  const [targetAssetAmount, setTargetAssetAmount] = useState<
    number | undefined
  >(isBtcOnchain(sourceAsset) ? 0.0001 : 50);
  const [lastFieldEdited, setLastFieldEdited] = useState<
    "sourceAsset" | "targetAsset"
  >("targetAsset");
  const [targetAddress, setTargetAddress] = useState("");
  const [addressValid, setAddressValid] = useState(false);
  const [userEvmAddress, setUserEvmAddress] = useState<string>("");
  const [isEvmAddressValid, setIsEvmAddressValid] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const { arkAddress, isEmbedded } = useWalletBridge();

  // --- Pairs ---
  const {
    availableSourceAssets,
    getAvailableTargetAssets,
    tokens,
    isLoading: isPairsLoading,
    getSourceDecimals,
    getTargetDecimals,
  } = usePairs();
  const availableTargetAssets = getAvailableTargetAssets(sourceAsset);
  const isInitialLoading = isPairsLoading;

  const sourceAssetDecimalPlaces = getSourceDecimals(sourceAsset);
  const targetAssetDecimalPlaces = getTargetDecimals(targetAsset);

  // --- Auto-populate EVM address from connected wallet ---
  useEffect(() => {
    if (isConnected && connectedAddress) {
      setUserEvmAddress(connectedAddress);
      setIsEvmAddressValid(true);
    } else {
      setUserEvmAddress("");
      setIsEvmAddressValid(false);
    }
  }, [isConnected, connectedAddress]);

  // Track wallet connection/disconnection
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current) {
      posthog?.capture("wallet_connected", { address: connectedAddress });
    } else if (!isConnected && prevConnectedRef.current) {
      posthog?.capture("wallet_disconnected");
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, connectedAddress, posthog?.capture]);

  // Check if wallet is on the correct chain for the EVM asset (source or target)
  const expectedChain = isEvmToken(sourceAsset)
    ? getViemChain(sourceAsset)
    : isEvmToken(targetAsset)
      ? getViemChain(targetAsset)
      : null;
  const isWrongChain =
    isConnected &&
    expectedChain &&
    connectedChain &&
    connectedChain.id !== expectedChain.id;

  // Auto-switch to correct chain when wrong chain detected
  useEffect(() => {
    if (isWrongChain && expectedChain && switchChainAsync) {
      switchChainAsync({ chainId: expectedChain.id }).catch((err) => {
        console.error("Failed to auto-switch chain:", err);
      });
    }
  }, [isWrongChain, expectedChain, switchChainAsync]);

  // Auto-populate target address with arkAddress if embedded and target is btc_arkade
  useEffect(() => {
    if (isEmbedded && arkAddress && isArkade(targetAsset) && !targetAddress) {
      setTargetAddress(arkAddress);
    }
  }, [isEmbedded, arkAddress, targetAsset, targetAddress]);

  // Auto-populate Lightning address from Speed Wallet if available
  useEffect(() => {
    const isSpeedWallet = isValidSpeedWalletContext();
    const speedLnAddress = getSpeedLightningAddress();

    if (
      isSpeedWallet &&
      speedLnAddress &&
      isLightning(targetAsset) &&
      !targetAddress
    ) {
      setTargetAddress(speedLnAddress);
    }
  }, [targetAsset, targetAddress]);

  // --- Quote-based exchange rate ---
  useEffect(() => {
    const fetchQuote = async () => {
      // Determine the BTC amount from whichever field has a value
      let amount: number;
      if (isEvmToken(sourceAsset)) {
        amount = targetAssetAmount ?? 0;
      } else if (isBtcOnchain(sourceAsset) && isArkade(targetAsset)) {
        amount = targetAssetAmount ?? 0;
      } else if (isBtcOnchain(sourceAsset) && isEvmToken(targetAsset)) {
        amount = sourceAssetAmount ?? 0;
      } else {
        amount = sourceAssetAmount ?? 0;
      }

      if (!amount || amount <= 0) {
        setQuote(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        const sats = Math.round(amount * 100_000_000);
        if (sats > 0) {
          const q = await api.getQuote({
            from: sourceAsset,
            to: targetAsset,
            base_amount: sats,
          });
          setQuote(q);
        }
      } catch {
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    fetchQuote();
  }, [sourceAssetAmount, targetAssetAmount, sourceAsset, targetAsset]);

  // Derive exchange rate from quote
  const exchangeRate = useMemo(() => {
    if (!quote) return null;
    const fiatPerBtc = parseFloat(quote.exchange_rate);
    // Quote always returns "fiat per BTC"
    // For BTC→EVM: use as-is (1 BTC = X fiat)
    // For EVM→BTC: invert (1 fiat = 1/X BTC)
    return computeExchangeRate(
      1 / fiatPerBtc,
      isBtc(sourceAsset),
      isEvmToken(targetAsset),
    );
  }, [quote, sourceAsset, targetAsset]);

  // Calculation effect — both rate and fees come from quote
  useEffect(() => {
    if (isLoadingQuote || !exchangeRate) return;

    const networkFeeInBtc = Number(quote?.network_fee ?? 0) / 100_000_000;
    const isSourceBtc = isBtc(sourceAsset);
    const isTargetBtc = isBtc(targetAsset);

    if (lastFieldEdited === "sourceAsset") {
      if (sourceAssetAmount === undefined) {
        setTargetAssetAmount(undefined);
        return;
      }

      const targetAmount = calculateTargetAmount(
        sourceAssetAmount,
        exchangeRate,
        networkFeeInBtc,
        isSourceBtc,
        isTargetBtc,
      );

      const decimals = targetAssetDecimalPlaces ?? 2;
      const formattedTargetAssetAmount = Number.parseFloat(
        targetAmount.toFixed(decimals),
      );
      console.log(
        `Calculated target amount is ${formattedTargetAssetAmount}`,
        targetAmount,
        targetAssetDecimalPlaces,
      );
      setTargetAssetAmount(formattedTargetAssetAmount);
    }

    if (lastFieldEdited === "targetAsset") {
      if (targetAssetAmount === undefined) {
        setSourceAssetAmount(undefined);
        return;
      }

      const sourceAmount = calculateSourceAmount(
        targetAssetAmount,
        exchangeRate,
        networkFeeInBtc,
        isSourceBtc,
        isTargetBtc,
      );

      const decimals = sourceAssetDecimalPlaces ?? 2;
      const newSourceAssetAmount = Number.parseFloat(
        sourceAmount.toFixed(decimals),
      );
      setSourceAssetAmount(newSourceAssetAmount);
    }
  }, [
    exchangeRate,
    isLoadingQuote,
    lastFieldEdited,
    targetAssetAmount,
    sourceAssetAmount,
    targetAssetDecimalPlaces,
    sourceAssetDecimalPlaces,
    quote,
    sourceAsset,
    targetAsset,
  ]);

  // --- USD prices (CoinGecko, display-only) ---
  const [usdPrices, setUsdPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const fetchPrices = async () => {
      const priceMap = await api.getTokenUsdPrices();
      setUsdPrices(priceMap);
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const getUsdPerToken = (tokenId: TokenId): number => {
    const price = usdPrices.get(tokenId);
    if (price !== undefined) return price;
    if (tokenId.includes("usdc") || tokenId.includes("usdt")) return 1;
    return 0;
  };

  // --- Create swap ---
  const { createSwap, isCreatingSwap, swapError } = useCreateSwap({
    sourceAsset,
    targetAsset,
    sourceAssetAmount,
    targetAssetAmount,
    targetAddress,
    userEvmAddress,
    isEvmAddressValid,
    lastFieldEdited,
  });

  const handleContinueToFund = async () => {
    if (!targetAddress || !sourceAssetAmount || !addressValid) {
      return;
    }

    await createSwap();
  };

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
              value={sourceAssetAmount}
              onChange={(value) => {
                setLastFieldEdited("sourceAsset");
                setSourceAssetAmount(value);
              }}
              decimals={
                isEvmToken(sourceAsset)
                  ? tokens.find((t) => t.token_id === sourceAsset)?.decimals
                  : 8
              }
              showCurrencyPrefix={true}
              usdPerToken={getUsdPerToken(sourceAsset)}
              tokenSymbol={
                isEvmToken(sourceAsset) ? getTokenSymbol(sourceAsset) : "BTC"
              }
            />
            <div className="shrink-0 pt-1">
              <AssetDropDown
                value={sourceAsset}
                availableAssets={availableSourceAssets}
                label="sell"
                onChange={(asset) => {
                  // Preserve USD value when changing currency
                  const currentUsdValue =
                    (sourceAssetAmount ?? 0) * getUsdPerToken(sourceAsset);
                  const newUsdPerToken = getUsdPerToken(asset);
                  const newAmount =
                    newUsdPerToken > 0
                      ? currentUsdValue / newUsdPerToken
                      : sourceAssetAmount;

                  // Special case: btc_onchain can be swapped to btc_arkade or EVM tokens
                  if (isBtcOnchain(asset)) {
                    const newTarget =
                      isArkade(targetAsset) || isEvmToken(targetAsset)
                        ? targetAsset
                        : "usdc_pol";
                    setSourceAsset(asset);
                    setTargetAsset(newTarget);
                    setSourceAssetAmount(newAmount);
                    navigate(`/${asset}/${newTarget}`, {
                      replace: true,
                    });
                    return;
                  }

                  const isEvmAsset = isEvmToken(asset);
                  const isBtcAsset = isBtc(asset);
                  const isEvmTarget = isEvmToken(targetAsset);
                  const isBtcTarget = isBtc(targetAsset);

                  // EVM source + BTC target = valid pair
                  if (isEvmAsset && isBtcTarget) {
                    setSourceAsset(asset);
                    setTargetAsset(targetAsset);
                    setSourceAssetAmount(newAmount);
                    navigate(`/${asset}/${targetAsset}`, { replace: true });
                    return;
                  }

                  // BTC source + EVM target = valid pair
                  if (isBtcAsset && isEvmTarget) {
                    setSourceAsset(asset);
                    setTargetAsset(targetAsset);
                    setSourceAssetAmount(newAmount);
                    navigate(`/${asset}/${targetAsset}`, { replace: true });
                    return;
                  }

                  // EVM source + EVM target = invalid, switch target to BTC
                  if (isEvmAsset && isEvmTarget) {
                    setSourceAsset(asset);
                    setTargetAsset(BTC_ARKADE);
                    setSourceAssetAmount(newAmount);
                    navigate(`/${asset}/btc_arkade`, { replace: true });
                    return;
                  }

                  // BTC source + BTC target = invalid, switch target to default stablecoin
                  if (isBtcAsset && isBtcTarget) {
                    setSourceAsset(asset);
                    setTargetAsset("usdc_pol" as TokenId);
                    setSourceAssetAmount(newAmount);
                    navigate(`/${asset}/usdc_pol`, { replace: true });
                    return;
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
            // btc_onchain can only be in sell position, not buy position
            if (isBtcOnchain(sourceAsset)) {
              return;
            }

            // Swap source and target tokens
            const newSource = targetAsset;
            const newTarget = sourceAsset;
            setSourceAsset(newSource);
            setTargetAsset(newTarget);

            // Also swap the amounts
            const newSourceAmount = targetAssetAmount;
            const newTargetAmount = sourceAssetAmount;
            setSourceAssetAmount(newSourceAmount);
            setTargetAssetAmount(newTargetAmount);

            navigate(`/${newSource}/${newTarget}`, { replace: true });
            setTargetAddress("");
            setAddressValid(false);
          }}
          disabled={isBtcOnchain(sourceAsset)}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 group/swap ${isBtcOnchain(sourceAsset) ? "opacity-50 cursor-not-allowed" : ""}`}
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
              value={targetAssetAmount}
              onChange={(value) => {
                setLastFieldEdited("targetAsset");
                setTargetAssetAmount(value);
              }}
              decimals={
                isEvmToken(targetAsset)
                  ? tokens.find((t) => t.token_id === sourceAsset)?.decimals
                  : 8
              }
              showCurrencyPrefix={true}
              isLoading={isLoadingQuote}
              usdPerToken={getUsdPerToken(targetAsset)}
              tokenSymbol={getTokenSymbol(targetAsset)}
            />
            <div className="shrink-0 pt-1">
              <AssetDropDown
                availableAssets={availableTargetAssets}
                value={targetAsset}
                onChange={(asset) => {
                  // Preserve USD value when changing currency
                  const currentUsdValue =
                    (targetAssetAmount ?? 0) * getUsdPerToken(targetAsset);
                  const newUsdPerToken = getUsdPerToken(asset);
                  const newAmount =
                    newUsdPerToken > 0
                      ? currentUsdValue / newUsdPerToken
                      : targetAssetAmount;

                  // Special case: when source is btc_onchain, allow btc_arkade or EVM tokens
                  if (isBtcOnchain(sourceAsset)) {
                    if (isArkade(asset) || isEvmToken(asset)) {
                      setTargetAsset(asset);
                      setTargetAssetAmount(newAmount);
                      navigate(`/${sourceAsset}/${asset}`, { replace: true });
                      setTargetAddress("");
                      setAddressValid(false);
                    }
                    return;
                  }

                  // Check if new target is compatible with current source
                  const isBtcTarget = isBtc(asset);
                  const isBtcSource = isBtc(sourceAsset);
                  const isEvmTarget = isEvmToken(asset);
                  const isEvmSource = isEvmToken(sourceAsset);

                  // If both are BTC or both are EVM, auto-switch source
                  if (isBtcTarget && isBtcSource) {
                    setSourceAsset("usdc_pol" as TokenId);
                    setTargetAsset(asset);
                    setTargetAssetAmount(newAmount);
                    navigate(`/usdc_pol/${asset}`, { replace: true });
                    return;
                  }

                  if (isEvmTarget && isEvmSource) {
                    setSourceAsset(BTC_ARKADE);
                    setTargetAsset(asset);
                    setTargetAssetAmount(newAmount);
                    navigate(`/btc_arkade/${asset}`, { replace: true });
                    return;
                  }

                  // Compatible pair, just update target
                  setTargetAsset(asset);
                  setTargetAssetAmount(newAmount);
                  navigate(`/${sourceAsset}/${asset}`, { replace: true });
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
          setAddressIsValid={setAddressValid}
          setBitcoinAmount={(amount) => {
            setLastFieldEdited("targetAsset");
            setTargetAssetAmount(amount);
          }}
          disabled={isEmbedded && !!arkAddress && isArkade(targetAsset)}
        />

        {/* Fees - below inputs, above Continue button */}
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
            {isEvmToken(sourceAsset) && isConnected && (
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
            {isEvmToken(sourceAsset) && isConnected && (
              <div>Gas Fee: check in wallet when signing</div>
            )}
          </div>
        ) : null}

        <div className="pt-2">
          {/* Show Connect Wallet button when:
              1. EVM source (user needs to pay gas to send EVM tokens)
              2. BTC source + Ethereum target (user needs to pay gas to claim on Ethereum)
              Note: BTC → Polygon uses Gelato Relay so no wallet needed */}
          {!isValidSpeedWalletContext() &&
          !isConnected &&
          (isEvmToken(sourceAsset) ||
            (isBtc(sourceAsset) && isEthereumToken(targetAsset))) ? (
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
                (isEvmToken(sourceAsset) && !isEvmAddressValid)
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

        {/* Swap Error Display */}
        {swapError && (
          <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl border p-3 text-sm">
            {swapError}
          </div>
        )}
      </div>
    </div>
  );
}
