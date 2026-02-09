import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { usePostHog } from "posthog-js/react";
import { useAccount, useSwitchChain } from "wagmi";
import { useAsync } from "react-use";
import {
  BTC_ARKADE,
  BTC_LIGHTNING,
  isArkade,
  isBtc,
  isBtcOnchain,
  isEvmToken,
  isLightning,
  type TokenId,
} from "@lendasat/lendaswap-sdk-pure";
import {
  getSpeedLightningAddress,
  isValidSpeedWalletContext,
} from "../../utils/speedWallet";
import { api, type QuoteResponse } from "../api";
import { usePriceFeed } from "../PriceFeedContext";
import {
  calculateSourceAmount,
  calculateTargetAmount,
} from "../utils/priceUtils";
import { getViemChain, isValidTokenId } from "../utils/tokenUtils";
import { useWalletBridge } from "../WalletBridgeContext";

export function useSwapForm() {
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
  // State for home page
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

  // Auto-populate Polygon address from connected wallet
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

  // Get price feed from context
  const { getExchangeRate, isLoadingPrice } = usePriceFeed();

  const exchangeRate = getExchangeRate(
    sourceAsset,
    targetAsset,
    sourceAssetAmount ?? 0,
  );

  // Fetch USD prices for all supported tokens from CoinGecko
  const [usdPrices, setUsdPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const fetchPrices = async () => {
      const priceMap = await api.getTokenUsdPrices();
      setUsdPrices(priceMap);
    };

    fetchPrices();
    // Refresh prices every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  // Helper to get USD price for a token (defaults to 1 for stablecoins if not found)
  const getUsdPerToken = (tokenId: TokenId): number => {
    const price = usdPrices.get(tokenId);
    if (price !== undefined) return price;
    // Fallback: assume stablecoins are $1
    if (tokenId.includes("usdc") || tokenId.includes("usdt")) return 1;
    return 0;
  };

  const { value: maybeAssetPairs, error: loadingAssetPairsError } = useAsync(
    async () => {
      return await api.getAssetPairs();
    },
  );
  if (loadingAssetPairsError) {
    console.error("Failed loading asset pairs", loadingAssetPairsError);
  }

  const { value: maybeTokens, error: loadingTokensError } = useAsync(
    async () => {
      return await api.getTokens();
    },
  );
  if (loadingTokensError) {
    console.error("Failed loading tokens", loadingTokensError);
  }

  const { error: loadingEvmTokensError } = useAsync(async () =>
    api.getEvmTokens(),
  );
  if (loadingEvmTokensError) {
    console.error("Failed loading EVM tokens", loadingEvmTokensError);
  }

  const assetPairs = maybeAssetPairs || [];
  const tokens = maybeTokens || [];
  const isInitialLoading = !maybeAssetPairs || !maybeTokens;

  const targetAssetDecimalPlaces = assetPairs.find(
    (pair) => pair.target.token_id === targetAsset,
  )?.target.decimals;
  const sourceAssetDecimalPlaces = assetPairs.find(
    (pair) => pair.source.token_id === sourceAsset,
  )?.source.decimals;

  useEffect(() => {
    if (isLoadingPrice || !exchangeRate) {
      return;
    }

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
    isLoadingPrice,
    lastFieldEdited,
    targetAssetAmount,
    sourceAssetAmount,
    targetAssetDecimalPlaces,
    sourceAssetDecimalPlaces,
    quote,
    sourceAsset,
    targetAsset,
  ]);

  // Fetch quote when bitcoin amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (targetAssetAmount === undefined || targetAssetAmount <= 0) {
        setQuote(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        // Convert BTC to satoshis
        let amount: number;
        if (isEvmToken(sourceAsset)) {
          amount = targetAssetAmount;
        } else if (isBtcOnchain(sourceAsset) && isArkade(targetAsset)) {
          amount = targetAssetAmount;
        } else if (isBtcOnchain(sourceAsset) && isEvmToken(targetAsset)) {
          amount = sourceAssetAmount ?? 0;
        } else {
          amount = sourceAssetAmount ?? 0;
        }

        const sats = Math.round(amount * 100_000_000);
        if (sats > 0) {
          const quoteResponse = await api.getQuote({
            from: sourceAsset,
            to: targetAsset,
            base_amount: sats,
          });
          setQuote(quoteResponse);
        }
      } catch (error) {
        console.error("Failed to fetch quote:", error);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    fetchQuote();
  }, [targetAssetAmount, sourceAsset, targetAsset, sourceAssetAmount]);

  const availableSourceAssets: TokenId[] = [
    ...new Map(
      assetPairs.map((a) => [a.source.token_id, a.source.token_id]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));

  // Always show all available tokens that can be bought (both BTC and EVM)
  const availableTargetAssets: TokenId[] = (() => {
    if (isBtcOnchain(sourceAsset)) {
      // On-chain BTC can be swapped to Arkade or EVM tokens
      return [
        BTC_ARKADE,
        ...availableSourceAssets.filter(
          (a) => isEvmToken(a) && !isBtcOnchain(a) && !isLightning(a),
        ),
      ].sort((a, b) => a.localeCompare(b));
    }

    if (isEvmToken(sourceAsset)) {
      // EVM BTC can be swapped to Arkade or Lightning tokens
      return [
        ...availableSourceAssets.filter(
          (a) => !isEvmToken(a) && a !== sourceAsset && !isBtcOnchain(a),
        ),
      ].sort((a, b) => a.localeCompare(b));
    }

    if (isBtc(sourceAsset)) {
      // Any BTC can be swapped to Arkade or EVM tokens
      return [...availableSourceAssets.filter((a) => isEvmToken(a))].sort(
        (a, b) => a.localeCompare(b),
      );
    }

    return [
      ...new Map(
        [
          ...availableSourceAssets.filter((a) => !isBtc(a)),
          BTC_LIGHTNING,
          BTC_ARKADE,
        ].map((t) => [t, t]),
      ).values(),
    ]
      .filter((asset) => !isBtcOnchain(asset)) // btc_onchain can never be bought
      .sort((a, b) => a.localeCompare(b));
  })();

  return {
    // State
    sourceAsset,
    setSourceAsset,
    targetAsset,
    setTargetAsset,
    sourceAssetAmount,
    setSourceAssetAmount,
    targetAssetAmount,
    setTargetAssetAmount,
    lastFieldEdited,
    setLastFieldEdited,
    targetAddress,
    setTargetAddress,
    addressValid,
    setAddressValid,
    userEvmAddress,
    isEvmAddressValid,
    quote,
    isLoadingQuote,
    isLoadingPrice,
    // Computed
    exchangeRate,
    expectedChain,
    isWrongChain,
    isConnected,
    isInitialLoading,
    tokens,
    availableSourceAssets,
    availableTargetAssets,
    isEmbedded,
    arkAddress,
    // Helpers
    getUsdPerToken,
    navigate,
  };
}
