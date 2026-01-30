import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import "../assets/styles.css";
import {
  BTC_ARKADE,
  BTC_LIGHTNING,
  isArkade,
  isBtc,
  isBtcOnchain,
  isEthereumToken,
  isEvmToken,
  isLightning,
  networkName,
  type TokenId,
} from "@lendasat/lendaswap-sdk-pure";
import { ConnectKitButton } from "connectkit";
import {
  ArrowDown,
  ArrowLeftRight,
  Check,
  Download,
  Eye,
  Github,
  Key,
  Loader,
  Menu,
  Shield,
  Star,
  Tag,
  Upload,
  Wallet,
} from "lucide-react";
import { useAsync } from "react-use";
import { useAccount, useSwitchChain } from "wagmi";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "#/components/ui/accordion";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Skeleton } from "#/components/ui/skeleton";
import { ReactComponent as BitcoinIcon } from "../assets/bitcoin.svg";
import { ReactComponent as LendasatBlack } from "../assets/lendasat_black.svg";
import { ReactComponent as LendasatGrey } from "../assets/lendasat_grey.svg";
import { ReactComponent as XLogo } from "../assets/x-com-logo.svg";
import {
  isLightningAddress,
  resolveLightningAddress,
} from "../utils/lightningAddress";
import {
  getSpeedLightningAddress,
  isValidSpeedWalletContext,
} from "../utils/speedWallet";
import {
  api,
  type GetSwapResponse,
  getTokenSymbol,
  type QuoteResponse,
} from "./api";
import { AddressInput } from "./components/AddressInput";
import { AmountInput } from "./components/AmountInput";
import { AssetDropDown } from "./components/AssetDropDown";
import { BackupMnemonicDialog } from "./components/BackupMnemonicDialog";
import { DebugNavigation } from "./components/DebugNavigation";
import { ImportMnemonicDialog } from "./components/ImportMnemonicDialog";
import { ReferralCodeDialog } from "./components/ReferralCodeDialog";
import { usePriceFeed } from "./PriceFeedContext";
import { RefundPage, SwapsPage, TermsOfServicePage } from "./pages";
import {
  calculateSourceAmount,
  calculateTargetAmount,
} from "./utils/priceUtils";
import { hasReferralCode } from "./utils/referralCode";
import { useTheme } from "./utils/theme-provider";
import { ThemeToggle } from "./utils/theme-toggle";
import { getViemChain, isValidTokenId } from "./utils/tokenUtils";
import { useWalletBridge } from "./WalletBridgeContext";
import { SwapWizardPage } from "./wizard";

// Home page component (enter-amount step)
function HomePage() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const params = useParams<{ sourceToken?: string; targetToken?: string }>();
  const {
    address: connectedAddress,
    isConnected,
    chain: connectedChain,
  } = useAccount();
  const { switchChainAsync } = useSwitchChain();

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
  const [isCreatingSwap, setIsCreatingSwap] = useState(false);
  const [swapError, setSwapError] = useState<string>("");
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

  console.log(`Expected chain `, expectedChain?.name);

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

  // TODO: remove cast once PriceFeedContext uses pure SDK TokenId
  // biome-ignore lint/suspicious/noExplicitAny: boundary between old and new SDK TokenId types
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

  const handleContinueToFund = async () => {
    if (!targetAddress || !sourceAssetAmount || !addressValid) {
      return;
    }

    await createSwap();
  };

  // Helper to track swap initiation
  const trackSwapInitiation = (swap: GetSwapResponse) => {
    // TODO: remove cast once GetSwapResponse uses pure SDK TokenId
    // biome-ignore lint/suspicious/noExplicitAny: boundary between old and new SDK TokenId types
    const swapDirection = isBtc(swap.source_token as any)
      ? "btc-to-evm"
      : "evm-to-btc";
    // Use sats_receive if available, otherwise use btc_expected_sats for onchain-to-evm swaps
    const amountSats =
      "sats_receive" in swap
        ? swap.sats_receive
        : "btc_expected_sats" in swap
          ? swap.btc_expected_sats
          : 0;
    posthog?.capture("swap_initiated", {
      swap_id: swap.id,
      swap_direction: swapDirection,
      source_token: swap.source_token,
      target_token: swap.target_token,
      amount_asset: swap.source_amount,
      amount_sats: amountSats,
      has_referral_code: hasReferralCode(),
    });
  };

  const createSwap = async () => {
    try {
      setIsCreatingSwap(true);
      setSwapError("");

      // Detect swap direction
      const isBtcSource = isBtc(sourceAsset);
      const isEvmSource = isEvmToken(sourceAsset);
      const isOnchainBtcSource = isBtcOnchain(sourceAsset);

      // On-chain BTC → Arkade
      if (isOnchainBtcSource && isArkade(targetAsset)) {
        // FIXME: these amounts are odd
        const satsToReceive = Math.floor(
          (targetAssetAmount ?? 0) * 100_000_000,
        );

        const swap = await api.createBitcoinToArkadeSwap({
          target_arkade_address: targetAddress,
          sats_receive: satsToReceive,
        });

        trackSwapInitiation(swap);
        navigate(`/swap/${swap.id}/wizard`);
        return;
      }

      // On-chain BTC → EVM
      if (isOnchainBtcSource && isEvmToken(targetAsset)) {
        const sourceAmount = sourceAssetAmount
          ? BigInt(Math.round(sourceAssetAmount * 100_000_000))
          : BigInt(0);

        const parsedNetworkName = networkName(targetAsset) as
          | "ethereum"
          | "polygon";

        const swap = await api.createOnchainToEvmSwap(
          {
            target_address: targetAddress,
            source_amount: sourceAmount,
            target_token: targetAsset,
          },
          parsedNetworkName,
        );

        trackSwapInitiation(swap);
        navigate(`/swap/${swap.id}/wizard`);
        return;
      }

      if (isBtcSource && !isOnchainBtcSource) {
        // BTC (Arkade/Lightning) → EVM
        let sourceAmount: bigint | undefined;
        let targetAmount: number | undefined;

        if (lastFieldEdited === "targetAsset") {
          targetAmount = targetAssetAmount;
          console.log(
            `Creating a swap to receive ${targetAmount} ${targetAsset}`,
          );
        } else {
          sourceAmount = sourceAssetAmount
            ? BigInt(Math.round(sourceAssetAmount * 100000000))
            : undefined;
          console.log(`Creating a swap to send ${sourceAmount} sats`);
        }

        const parsedNetworkName = networkName(targetAsset) as
          | "ethereum"
          | "polygon";
        switch (sourceAsset) {
          case BTC_LIGHTNING: {
            const swap = await api.createLightningToEvmSwap(
              {
                target_address: targetAddress,
                source_amount: sourceAmount,
                target_amount: targetAmount,
                target_token: targetAsset,
              },
              parsedNetworkName,
            );

            trackSwapInitiation(swap);
            navigate(`/swap/${swap.id}/wizard`);
            break;
          }
          case BTC_ARKADE: {
            const swap = await api.createArkadeToEvmSwap(
              {
                target_address: targetAddress,
                source_amount: sourceAmount,
                target_amount: targetAmount,
                target_token: targetAsset,
              },
              parsedNetworkName,
            );

            trackSwapInitiation(swap);
            navigate(`/swap/${swap.id}/wizard`);
            break;
          }
          default:
            console.error(`Invalid source asset ${sourceAsset}`);
            return;
        }
      } else if (isEvmSource) {
        // EVM → Bitcoin

        // Validate EVM address
        if (!isEvmAddressValid) {
          setSwapError(`Please provide a valid wallet address`);
          return;
        }

        if (isArkade(targetAsset)) {
          // EVM → Arkade

          // Call EVM → Arkade API
          const swap = await api.createEvmToArkadeSwap(
            {
              target_address: targetAddress, // Arkade address
              source_amount: sourceAssetAmount ?? 0,
              source_token: sourceAsset,
              user_address: userEvmAddress,
            },
            networkName(sourceAsset) as "ethereum" | "polygon",
          );

          console.log(`Created swap ${swap.id}`);

          trackSwapInitiation(swap);
          navigate(`/swap/${swap.id}/wizard`);
        }

        if (isLightning(targetAsset)) {
          // EVM → Lightning

          // Resolve Lightning address to BOLT11 invoice if needed
          let bolt11Invoice = targetAddress;
          if (isLightningAddress(targetAddress)) {
            try {
              const amountSats = (targetAssetAmount ?? 0) * 100_000_000; // Convert BTC to sats
              bolt11Invoice = await resolveLightningAddress(
                targetAddress,
                amountSats,
              );
            } catch (error) {
              setSwapError(
                `Failed to resolve Lightning address: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
              return;
            }
          }

          // Call EVM → Lightning API
          const swap = await api.createEvmToLightningSwap(
            {
              bolt11_invoice: bolt11Invoice,
              source_token: sourceAsset,
              user_address: userEvmAddress,
            },
            networkName(sourceAsset) as "ethereum" | "polygon",
          );

          trackSwapInitiation(swap);
          navigate(`/swap/${swap.id}/wizard`);
        }
      }
    } catch (error) {
      console.error("Failed to create swap:", error);
      setSwapError(
        error instanceof Error
          ? error.message
          : `Failed to create swap: ${error}`,
      );
    } finally {
      setIsCreatingSwap(false);
    }
  };

  console.log(`Asset Pairs ${JSON.stringify(assetPairs)}`);

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
        <div className="rounded-2xl bg-muted p-4 pb-5">
          <div className="text-sm text-muted-foreground mb-2">Sell</div>
          <div className="flex items-center justify-between gap-4">
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
            <div className="shrink-0">
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
                    // Keep current target if it's Arkade or EVM, otherwise default to usdc_pol
                    const newTarget =
                      isArkade(targetAsset) || isEvmToken(targetAsset)
                        ? targetAsset
                        : "usdc_pol";
                    setSourceAsset(asset);
                    setTargetAsset(newTarget);
                    setSourceAssetAmount(newAmount);
                    navigate(` / ${asset}/${newTarget}`, {
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
                    navigate(` / $){asset}/${targetAsset}`, { replace: true });
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
                    setTargetAsset("usdc_pol");
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
          onClick={() => {
            // btc_onchain can only be in sell position, not buy position
            // Don't allow swapping if it would put btc_onchain in target
            if (isBtcOnchain(sourceAsset)) {
              return;
            }

            // Swap source and target tokens
            const newSource = targetAsset;
            const newTarget = sourceAsset;
            setSourceAsset(newSource);
            setTargetAsset(newTarget);

            // Also swap the amounts so the values make sense for the new direction
            const newSourceAmount = targetAssetAmount;
            const newTargetAmount = sourceAssetAmount;
            setSourceAssetAmount(newSourceAmount);
            setTargetAssetAmount(newTargetAmount);

            navigate(`/${newSource}/${newTarget}`, { replace: true });
            // Clear target address since it may not be valid for the new target token type
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
        <div className="rounded-2xl bg-muted p-4 pt-5 mt-1">
          <div className="text-sm text-muted-foreground mb-2">Buy</div>
          <div className="flex items-center justify-between gap-4">
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
              isLoading={isLoadingPrice}
              usdPerToken={getUsdPerToken(targetAsset)}
              tokenSymbol={getTokenSymbol(targetAsset)}
            />
            <div className="shrink-0">
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
                      // Clear target address since it may not be valid for the new target token type
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

                  // If both are BTC or both are EVM, auto-switch source to make them compatible
                  if (isBtcTarget && isBtcSource) {
                    // Buying BTC but selling BTC - switch source to default EVM stablecoin
                    setSourceAsset("usdc_pol");
                    setTargetAsset(asset);
                    setTargetAssetAmount(newAmount);
                    navigate(`/usdc_pol/${asset}`, { replace: true });
                    return;
                  }

                  if (isEvmTarget && isEvmSource) {
                    // Buying EVM but selling EVM - switch source to default BTC
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
            // this is only used for lightning invoices, hence, the last edited field must be the target field which needs to be lightning
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

// Get step title and description based on current route
function useStepInfo() {
  const location = useLocation();
  const isSpeedWallet = isValidSpeedWalletContext();

  // Check if on home page (token pair route like /btc_lightning/usdc_pol)
  const isHomePage =
    location.pathname === "/" || /^\/[^/]+\/[^/]+$/.test(location.pathname);

  if (isHomePage) {
    return {
      title: isSpeedWallet
        ? "⚡ Lightning-fast Bitcoin to Stablecoins"
        : "Lightning-fast Bitcoin to Stablecoins",
      description: "",
      isHomePage: true,
    };
  } else if (location.pathname.includes("/send")) {
    return {
      title: "Send Bitcoin",
      description: "Use one of the addresses below",
    };
  } else if (location.pathname.includes("/processing")) {
    return {
      title: "Processing Swap",
      description: "Please wait while we process your transaction",
    };
  } else if (location.pathname.includes("/success")) {
    return {
      title: "Swap Complete",
      description: "Your swap has been completed successfully",
    };
  } else if (location.pathname === "/swaps") {
    return {
      title: "Your Swaps",
      description: "View and manage all your swaps",
    };
  } else if (location.pathname.includes("/manage/")) {
    return {
      title: "Manage Swap",
      description: "View details and refund your swap",
    };
  } else if (location.pathname.includes("/refund")) {
    return {
      title: "Refund Swap",
      description: "Reclaim your funds from an expired swap",
    };
  }

  return {
    title: "",
    description: "",
  };
}

export default function App() {
  const { theme } = useTheme();
  const stepInfo = useStepInfo();
  const location = useLocation();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [hasCode, setHasCode] = useState(hasReferralCode());

  // Check if on home page (token pair route like /btc_lightning/usdc_pol)
  const isHomePage =
    location.pathname === "/" || /^\/[^/]+\/[^/]+$/.test(location.pathname);

  const handleDownloadSeedphrase = async () => {
    try {
      const mnemonic = await api.getMnemonic();

      if (!mnemonic) {
        console.error("No mnemonic found");
        return;
      }

      // Create a blob with the mnemonic
      const blob = new Blob([mnemonic], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `lendaswap-phrase-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download mnemonic:", error);
    }
  };

  return (
    <div className="bg-background min-h-screen relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground) / 0.015) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground) / 0.015) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Modern Gradient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Top Left - Orange Gradient */}
        <div
          className="absolute -top-48 -left-48 w-[600px] h-[600px] opacity-100 dark:opacity-40"
          style={{
            background:
              "radial-gradient(circle at center, rgba(251, 146, 60, 0.08) 0%, rgba(249, 115, 22, 0.05) 25%, rgba(234, 88, 12, 0.03) 50%, transparent 70%)",
            filter: "blur(100px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Bottom Right - Orange to Amber Gradient */}
        <div
          className="absolute -bottom-40 -right-40 w-[550px] h-[550px] opacity-100 dark:opacity-40"
          style={{
            background:
              "radial-gradient(circle at center, rgba(251, 146, 60, 0.07) 0%, rgba(249, 115, 22, 0.04) 30%, rgba(245, 158, 11, 0.03) 50%, transparent 68%)",
            filter: "blur(110px)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2 transition-opacity hover:opacity-80"
                >
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black dark:bg-white">
                    {theme === "dark" ? (
                      <LendasatBlack className="h-5 w-5 shrink-0" />
                    ) : (
                      <LendasatGrey className="h-5 w-5 shrink-0" />
                    )}
                  </div>
                  <h1 className="text-xl font-semibold">LendaSwap</h1>
                </button>

                {/* GitHub Link */}
                <a
                  href="https://github.com/lendasat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/50 transition-colors text-foreground hover:text-foreground"
                  aria-label="Visit us on GitHub"
                >
                  <Github className="w-5 h-5" />
                </a>

                {/* X/Twitter Link */}
                <a
                  href="https://x.com/lendasat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/50 transition-colors text-foreground hover:text-foreground"
                  aria-label="Follow us on X"
                >
                  <XLogo className="w-5 h-5 fill-current" />
                </a>
              </div>

              <div className="flex items-center gap-3">
                {/* Mobile Dropdown Menu */}
                <div className="md:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Menu className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {hasCode ? (
                        <DropdownMenuItem disabled className="gap-2">
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-green-600 dark:text-green-400 font-bold">
                            NO-FEE
                          </span>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => setDialogOpen(true)}
                          className="gap-2"
                        >
                          <Tag className="h-4 w-4" />
                          Add your code
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem
                        onClick={() => navigate("/swaps")}
                        className="gap-2"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                        Swaps
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => setBackupDialogOpen(true)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Show Seedphrase
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={handleDownloadSeedphrase}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Seedphrase
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => setImportDialogOpen(true)}
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Import Seedphrase
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Hide Connect button in Speed Wallet - not needed */}
                      {!isValidSpeedWalletContext() && (
                        <ConnectKitButton.Custom>
                          {({
                            isConnected,
                            show,
                            truncatedAddress,
                            ensName,
                          }) => {
                            return (
                              <DropdownMenuItem onClick={show}>
                                <Wallet className="w-4 h-4 mr-2" />
                                {isConnected
                                  ? (ensName ?? truncatedAddress)
                                  : "Connect"}
                              </DropdownMenuItem>
                            );
                          }}
                        </ConnectKitButton.Custom>
                      )}

                      <DropdownMenuSeparator />

                      <DropdownMenuItem asChild>
                        <ThemeToggle />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Desktop Buttons */}
                <div className="hidden md:flex items-center gap-3">
                  {hasCode ? (
                    <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-2 py-1.5 sm:px-3">
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        NO-FEE
                      </span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogOpen(true)}
                      className="gap-2"
                    >
                      <Tag className="h-4 w-4" />
                      <span>Add your code</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/swaps")}
                    className="gap-2"
                    title="Swaps"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        title="Wallet Settings"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => setBackupDialogOpen(true)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Show Seedphrase
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDownloadSeedphrase}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Seedphrase
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setImportDialogOpen(true)}
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Import Seedphrase
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ThemeToggle />
                  {/* Hide Connect button in Speed Wallet - not needed */}
                  {!isValidSpeedWalletContext() && (
                    <ConnectKitButton.Custom>
                      {({ isConnected, show, truncatedAddress, ensName }) => {
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={show}
                            className="h-9"
                          >
                            <Wallet className="w-3.5 h-3.5 mr-1.5" />
                            {isConnected
                              ? (ensName ?? truncatedAddress)
                              : "Connect"}
                          </Button>
                        );
                      }}
                    </ConnectKitButton.Custom>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-5 md:px-6 py-16">
          <div className="mx-auto max-w-2xl space-y-10">
            {/* Title */}
            <div className="space-y-2 text-center">
              <h2
                className="text-xl md:text-3xl font-semibold"
                style={
                  stepInfo.isHomePage
                    ? {
                        maskImage:
                          "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.6) 100%)",
                        WebkitMaskImage:
                          "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.6) 100%)",
                      }
                    : undefined
                }
              >
                {stepInfo.isHomePage ? (
                  <>
                    <span>
                      {stepInfo.title.includes("⚡") ? "⚡ " : ""}Lightning-fast{" "}
                    </span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-400 drop-shadow-[0_0_6px_rgba(249,115,22,0.15)]">
                      Bitcoin
                    </span>
                    <span> to </span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500 drop-shadow-[0_0_6px_rgba(249,115,22,0.15)]">
                      Stablecoins
                    </span>
                  </>
                ) : (
                  stepInfo.title
                )}
              </h2>
              <p className="text-muted-foreground">{stepInfo.description}</p>
            </div>

            {/* Step Card */}
            <div className="mx-auto max-w-lg">
              <Routes>
                <Route
                  path="/swap/:swapId/wizard"
                  element={<SwapWizardPage />}
                />
                <Route path="/swap/:swapId/refund" element={<RefundPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route
                  path="*"
                  element={
                    <div className="group relative">
                      {/* Orange glow effect on hover */}
                      <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/0 opacity-0 blur-xl transition-all duration-500 group-hover:from-orange-500/10 group-hover:via-orange-400/8 group-hover:to-orange-500/10 group-hover:opacity-100" />
                      <Card className="relative rounded-3xl border border-border bg-gradient-to-br from-card via-card to-orange-500/5 shadow-sm min-h-[420px]">
                        <Routes>
                          <Route
                            path="/"
                            element={
                              <Navigate to="/btc_lightning/usdc_pol" replace />
                            }
                          />
                          <Route
                            path="/:sourceToken/:targetToken"
                            element={<HomePage />}
                          />
                          <Route path="/swaps" element={<SwapsPage />} />
                        </Routes>
                      </Card>
                    </div>
                  }
                />
              </Routes>
            </div>
          </div>

          {/* Stats & Features - Only show on home page */}
          {isHomePage && (
            <div className="mx-auto max-w-5xl mt-[240px] space-y-4 px-4">
              {/* Social Proof */}
              <div className="flex flex-col items-center justify-center mb-8">
                <div className="flex items-center -space-x-3 mb-3">
                  {[
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=f97316",
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=Mia&backgroundColor=fb923c",
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar&backgroundColor=fdba74",
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=f97316",
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=Max&backgroundColor=ea580c",
                  ].map((src) => (
                    <div
                      key={src}
                      className="relative transition-all duration-300 hover:z-10 hover:scale-110"
                    >
                      <img
                        src={src}
                        alt="User avatar"
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-background shadow-lg bg-orange-500/20"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm md:text-base text-muted-foreground font-medium flex items-center gap-1.5">
                  <span className="flex items-center text-orange-500">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                  </span>
                  <span className="ml-1">
                    Trusted by{" "}
                    <span className="text-foreground font-bold">4,102+</span>{" "}
                    Bitcoiners
                  </span>
                </p>
              </div>

              {/* Top Row - Bento Grid: Square left, Wide right */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Self-Custody - 100% Secured */}
                <div className="md:col-span-2 group relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-orange-500/5 p-4 md:p-6 shadow-sm transition-all duration-300 hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/5 aspect-square md:aspect-square">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-transparent to-orange-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  {/* Background circles - Apple-style behind shield, animate on hover */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[240px] h-[240px] md:w-[320px] md:h-[320px] rounded-full bg-gradient-to-br from-orange-400/[0.08] to-orange-600/[0.03] blur-sm opacity-0 scale-50 transition-all duration-700 ease-out group-hover:opacity-100 group-hover:scale-100" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[180px] h-[180px] md:w-[240px] md:h-[240px] rounded-full border border-orange-500/[0.1] opacity-0 scale-50 transition-all duration-500 delay-100 ease-out group-hover:opacity-100 group-hover:scale-100" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[120px] h-[120px] md:w-[160px] md:h-[160px] rounded-full border border-orange-500/[0.15] opacity-0 scale-50 transition-all duration-500 delay-200 ease-out group-hover:opacity-100 group-hover:scale-100" />

                  <style>{`
                    .shield-container {
                      transition: transform 0.5s ease-out, filter 0.5s ease-out;
                    }
                    .group:hover .shield-container {
                      transform: scale(1.05);
                      filter: drop-shadow(0 0 25px rgba(249, 115, 22, 0.4));
                    }
                    .shield-check {
                      stroke-dasharray: 100;
                      stroke-dashoffset: 100;
                      transition: stroke-dashoffset 0.5s ease-out 0.15s;
                    }
                    .group:hover .shield-check {
                      stroke-dashoffset: 0;
                    }
                    .shield-fill {
                      transition: all 0.4s ease-out;
                    }
                    .group:hover .shield-fill {
                      filter: brightness(1.1);
                    }
                  `}</style>

                  {/* Animated Shield with Checkmark */}
                  <div className="flex-1 flex items-center justify-center h-full pb-6 md:pb-8">
                    <div className="shield-container">
                      <svg
                        viewBox="0 0 80 90"
                        className="w-24 h-[108px] md:w-32 md:h-[144px]"
                        aria-hidden="true"
                      >
                        {/* Shield fill with gradient */}
                        <path
                          className="shield-fill"
                          d="M40 5 L70 20 L70 45 C70 65 55 80 40 85 C25 80 10 65 10 45 L10 20 Z"
                          fill="url(#shieldGradient2)"
                        />
                        {/* Checkmark that draws on hover */}
                        <path
                          className="shield-check"
                          d="M26 45 L36 55 L54 37"
                          fill="none"
                          stroke="white"
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <defs>
                          <linearGradient
                            id="shieldGradient2"
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor="#fb923c" />
                            <stop offset="100%" stopColor="#c2410c" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>

                  <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6">
                    <div className="text-base md:text-xl font-bold tracking-tight text-foreground">
                      100% Secured
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground mt-0.5">
                      Your keys. Your money. Always.
                    </div>
                  </div>
                </div>

                {/* Mobile App Promo - Wide */}
                <div className="md:col-span-3 group relative rounded-3xl border border-border bg-gradient-to-br from-card via-card to-orange-500/5 p-4 md:p-6 shadow-sm transition-all duration-300 hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/5 aspect-square md:aspect-auto overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-transparent to-orange-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100 rounded-3xl" />

                  {/* Coming Soon - Big background text */}
                  <div className="absolute top-[35%] right-4 sm:right-8 md:right-12 -translate-y-1/2 flex flex-col items-end pointer-events-none">
                    <span className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tighter text-orange-500/[0.08] leading-none transition-all duration-500 group-hover:text-orange-500/[0.15]">
                      COMING
                    </span>
                    <span className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tighter text-orange-500/[0.12] leading-none transition-all duration-500 group-hover:text-orange-500/[0.2]">
                      SOON
                    </span>
                  </div>

                  {/* Phone - floating with gradient fade at bottom */}
                  <div className="absolute top-[50%] left-10 sm:left-14 md:left-20 -translate-y-1/2">
                    <div
                      className="relative transition-transform duration-500 ease-out group-hover:-translate-y-2"
                      style={{ perspective: "1000px" }}
                    >
                      {/* Phone Frame - bigger sizing */}
                      <div className="relative w-[100px] sm:w-[110px] md:w-[110px] lg:w-[130px] aspect-[1/2] rounded-[20px] sm:rounded-[22px] md:rounded-[24px] bg-gradient-to-b from-zinc-700 to-zinc-900 dark:from-zinc-600 dark:to-zinc-800 p-[3px] sm:p-[3px] md:p-[4px] shadow-xl shadow-black/20">
                        {/* Inner bezel */}
                        <div className="relative w-full h-full rounded-[17px] sm:rounded-[19px] md:rounded-[20px] bg-black overflow-hidden">
                          {/* Dynamic Island */}
                          <div className="absolute top-2.5 sm:top-3 md:top-3 left-1/2 -translate-x-1/2 w-[30px] sm:w-[32px] md:w-[34px] h-[8px] sm:h-[9px] md:h-[10px] bg-black rounded-full z-10" />
                          {/* Screen */}
                          <div className="w-full h-full bg-gradient-to-br from-orange-100 via-orange-50 to-white dark:from-orange-500/20 dark:via-orange-600/10 dark:to-orange-500/5" />
                          {/* Screen reflection */}
                          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                        </div>
                        {/* Side buttons */}
                        <div className="absolute -right-[2px] top-[35%] w-[2px] sm:w-[3px] h-[18%] bg-zinc-600 dark:bg-zinc-500 rounded-r-sm" />
                        <div className="absolute -left-[2px] top-[28%] w-[2px] sm:w-[3px] h-[12%] bg-zinc-600 dark:bg-zinc-500 rounded-l-sm" />
                        <div className="absolute -left-[2px] top-[42%] w-[2px] sm:w-[3px] h-[18%] bg-zinc-600 dark:bg-zinc-500 rounded-l-sm" />
                        {/* Gradient fade at bottom - starts earlier */}
                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-card via-card/70 to-transparent pointer-events-none rounded-b-[20px] sm:rounded-b-[22px] md:rounded-b-[24px]" />
                      </div>
                    </div>
                  </div>

                  {/* Text - positioned at bottom */}
                  <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6">
                    <div className="text-base md:text-xl font-bold tracking-tight text-foreground">
                      Get the App
                    </div>
                    <a
                      href="https://lendasat.com/app_waitlist"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-1.5 text-xs md:text-sm font-medium text-orange-500 hover:text-orange-400 transition-colors"
                    >
                      Join waitlist
                      <ArrowDown className="h-3 w-3 rotate-[-90deg]" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Middle Row - Bento Grid: Wide left, Square right */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Developer Docs - Wide */}
                <div className="md:col-span-3 group relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-orange-500/5 p-4 md:p-6 shadow-sm transition-all duration-300 hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/5 aspect-[4/3] md:aspect-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-transparent to-orange-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <style>{`
                    @keyframes typewriter {
                      from { max-width: 0; }
                      to { max-width: 100%; }
                    }
                    @keyframes blink {
                      0%, 50% { opacity: 1; }
                      51%, 100% { opacity: 0; }
                    }
                    .docs-terminal-line {
                      max-width: 100%;
                      overflow: hidden;
                      white-space: nowrap;
                    }
                    .group:hover .docs-terminal-line-1 { animation: typewriter 0.2s steps(25) forwards; max-width: 0; }
                    .group:hover .docs-terminal-line-2 { animation: typewriter 0.3s steps(35) 0.2s forwards; max-width: 0; }
                    .group:hover .docs-terminal-line-3 { animation: typewriter 0.25s steps(30) 0.5s forwards; max-width: 0; }
                    .group:hover .docs-terminal-line-4 { animation: typewriter 0.35s steps(40) 0.75s forwards; max-width: 0; }
                    .group:hover .docs-terminal-line-5 { animation: typewriter 0.3s steps(35) 1.1s forwards; max-width: 0; }
                    .group:hover .docs-terminal-cursor {
                      animation: blink 0.8s steps(1) infinite;
                    }
                  `}</style>
                  <div className="relative h-full flex flex-col justify-between">
                    {/* Terminal Mockup - Centered and narrower */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-[95%] rounded-2xl bg-zinc-100 dark:bg-zinc-950/95 border border-zinc-300 dark:border-zinc-800/80 overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/20">
                        {/* Terminal Header - Minimal */}
                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800/60">
                          <div className="flex gap-1.5">
                            <div className="w-[10px] h-[10px] rounded-full bg-zinc-400 dark:bg-zinc-700 group-hover:bg-red-500/90 transition-colors" />
                            <div className="w-[10px] h-[10px] rounded-full bg-zinc-400 dark:bg-zinc-700 group-hover:bg-yellow-500/90 transition-colors" />
                            <div className="w-[10px] h-[10px] rounded-full bg-zinc-400 dark:bg-zinc-700 group-hover:bg-green-500/90 transition-colors" />
                          </div>
                        </div>
                        {/* Terminal Content */}
                        <div className="px-3 py-2.5 md:px-4 md:py-3 font-mono text-[8px] md:text-[10px] leading-[1.7]">
                          <div className="docs-terminal-line docs-terminal-line-1 text-zinc-600 dark:text-zinc-400">
                            <span className="text-orange-500 dark:text-orange-400">
                              $
                            </span>{" "}
                            <span className="text-zinc-500">npm i</span>{" "}
                            @lendasat/lendaswap-sdk
                          </div>
                          <div className="docs-terminal-line docs-terminal-line-2 mt-1.5 text-zinc-600 dark:text-zinc-400">
                            <span className="text-orange-600 dark:text-orange-400/70">
                              import
                            </span>{" "}
                            {"{"}{" "}
                            <span className="text-orange-600 dark:text-orange-300">
                              Client
                            </span>
                            ,{" "}
                            <span className="text-orange-600 dark:text-orange-300">
                              createDexieSwapStorage
                            </span>{" "}
                            {"}"}
                          </div>
                          <div className="docs-terminal-line docs-terminal-line-3 mt-1 text-zinc-600 dark:text-zinc-400">
                            <span className="text-orange-600 dark:text-orange-400/70">
                              const
                            </span>{" "}
                            <span className="text-blue-600 dark:text-blue-300">
                              client
                            </span>{" "}
                            ={" "}
                            <span className="text-orange-600 dark:text-orange-400/70">
                              await
                            </span>{" "}
                            <span className="text-orange-600 dark:text-orange-300">
                              Client
                            </span>
                            .
                            <span className="text-amber-700 dark:text-amber-200/90">
                              create
                            </span>
                            (
                            <span className="text-amber-700 dark:text-amber-200/90">
                              url
                            </span>
                            ,{" "}
                            <span className="text-amber-700 dark:text-amber-200/90">
                              storage
                            </span>
                            )
                          </div>
                          <div className="docs-terminal-line docs-terminal-line-4 mt-1 text-zinc-600 dark:text-zinc-400">
                            <span className="text-orange-600 dark:text-orange-400/70">
                              const
                            </span>{" "}
                            <span className="text-blue-600 dark:text-blue-300">
                              swap
                            </span>{" "}
                            ={" "}
                            <span className="text-orange-600 dark:text-orange-400/70">
                              await
                            </span>{" "}
                            client.
                            <span className="text-amber-700 dark:text-amber-200/90">
                              createEvmToArkadeSwap
                            </span>
                            ({"{"}
                          </div>
                          <div className="docs-terminal-line docs-terminal-line-5 mt-1 text-zinc-600 dark:text-zinc-400">
                            {"  "}
                            <span className="text-blue-600 dark:text-blue-300">
                              source_token
                            </span>
                            :{" "}
                            <span className="text-amber-700 dark:text-amber-200/90">
                              'usdc_pol'
                            </span>
                            ,{" "}
                            <span className="text-blue-600 dark:text-blue-300">
                              target_address
                            </span>
                            :{" "}
                            <span className="text-amber-700 dark:text-amber-200/90">
                              addr
                            </span>{" "}
                            {"}"})
                            <span className="docs-terminal-cursor text-orange-500 dark:text-orange-400 ml-0.5">
                              |
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Text - Bottom aligned */}
                    <div>
                      <div className="text-base md:text-xl font-bold tracking-tight text-foreground">
                        Developer Docs
                      </div>
                      <a
                        href="https://lendasat.com/docs/lendaswap"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1.5 text-xs md:text-sm font-medium text-orange-500 hover:text-orange-400 transition-colors"
                      >
                        View docs
                        <ArrowDown className="h-3 w-3 rotate-[-90deg]" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Powered by Arkade - Square */}
                <div className="md:col-span-2 group relative aspect-square overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-purple-500/5 p-4 md:p-6 shadow-sm transition-all duration-300 hover:border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative h-full flex flex-col justify-between">
                    {/* Pixel art space invader with classic animation on hover */}
                    <div className="flex-1 flex items-center justify-center">
                      <style>{`
                        @keyframes invaderMove {
                          0%, 100% { transform: translateX(-10px); }
                          50% { transform: translateX(10px); }
                        }
                        @keyframes invaderFrame {
                          0%, 49% { opacity: 1; }
                          50%, 100% { opacity: 0; }
                        }
                        @keyframes invaderFrame2 {
                          0%, 49% { opacity: 0; }
                          50%, 100% { opacity: 1; }
                        }
                        .invader-container {
                          animation: none;
                        }
                        .group:hover .invader-container {
                          animation: invaderMove 1.5s ease-in-out infinite;
                        }
                        .invader-frame1 {
                          opacity: 1;
                        }
                        .invader-frame2 {
                          opacity: 0;
                        }
                        .group:hover .invader-frame1 {
                          animation: invaderFrame 0.8s steps(1) infinite;
                        }
                        .group:hover .invader-frame2 {
                          animation: invaderFrame2 0.8s steps(1) infinite;
                        }
                      `}</style>
                      <div className="relative invader-container">
                        {/* Frame 1 - legs out */}
                        <div className="grid grid-cols-11 gap-[1px] sm:gap-[2px] md:gap-[2px] lg:gap-[3px] absolute inset-0 invader-frame1">
                          {[
                            [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
                            [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                            [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                            [0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0],
                            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                            [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
                            [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
                            [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0],
                          ]
                            .flat()
                            .map((filled, i) => (
                              <div
                                key={`p1-${i.toString()}`}
                                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-3.5 lg:h-3.5 rounded-sm ${
                                  filled
                                    ? "bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]"
                                    : "bg-transparent"
                                }`}
                              />
                            ))}
                        </div>
                        {/* Frame 2 - legs in */}
                        <div className="grid grid-cols-11 gap-[1px] sm:gap-[2px] md:gap-[2px] lg:gap-[3px] invader-frame2">
                          {[
                            [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
                            [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
                            [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
                            [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
                            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                            [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                            [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
                            [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
                          ]
                            .flat()
                            .map((filled, i) => (
                              <div
                                key={`p2-${i.toString()}`}
                                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-3.5 lg:h-3.5 rounded-sm ${
                                  filled
                                    ? "bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.5)]"
                                    : "bg-transparent"
                                }`}
                              />
                            ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-base md:text-xl font-bold tracking-tight text-foreground">
                        Powered by Arkade · Bitcoin L2
                      </div>
                      <a
                        href="https://arkadeos.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1.5 text-xs md:text-sm font-medium text-purple-500 hover:text-purple-400 transition-colors"
                      >
                        Learn more
                        <ArrowDown className="h-3 w-3 rotate-[-90deg]" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row - 3 Feature Boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Instant */}
                <div className="group relative aspect-[4/3] md:aspect-square overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-orange-500/5 p-4 md:p-6 shadow-sm transition-all duration-300 hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-transparent to-orange-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <style>{`
                    @keyframes coinSpinLeft {
                      0% { transform: translateX(0) rotateY(0deg); }
                      50% { transform: translateX(20px) rotateY(180deg); }
                      100% { transform: translateX(0) rotateY(360deg); }
                    }
                    @keyframes coinSpinRight {
                      0% { transform: translateX(0) rotateY(0deg); }
                      50% { transform: translateX(-20px) rotateY(180deg); }
                      100% { transform: translateX(0) rotateY(360deg); }
                    }
                    .instant-coin-left, .instant-coin-right {
                      animation: none;
                    }
                    .group:hover .instant-coin-left {
                      animation: coinSpinLeft 0.8s ease-in-out;
                    }
                    .group:hover .instant-coin-right {
                      animation: coinSpinRight 0.8s ease-in-out;
                    }
                  `}</style>
                  <div className="relative h-full flex flex-col justify-between">
                    {/* Coin swap animation area */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="flex items-center gap-3 md:gap-5">
                        {/* USDT Coin - Left - Glossy Orange Glass */}
                        <div
                          className="instant-coin-left w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center shadow-xl relative"
                          style={{
                            perspective: "1000px",
                            transformStyle: "preserve-3d",
                            background:
                              "linear-gradient(135deg, rgba(251,146,60,0.9) 0%, rgba(249,115,22,0.8) 50%, rgba(234,88,12,0.9) 100%)",
                            boxShadow:
                              "0 8px 32px rgba(249,115,22,0.3), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            backdropFilter: "blur(8px)",
                          }}
                        >
                          <div
                            className="absolute inset-1 rounded-full"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)",
                            }}
                          />
                          {/* Tether T Symbol */}
                          <svg
                            viewBox="0 0 339.43 295.27"
                            className="relative w-7 h-7 md:w-9 md:h-9"
                            fill="white"
                            aria-hidden="true"
                          >
                            <path d="M191.19,144.8v0c-1.2.09-7.4,0.46-21.23,0.46-11,0-18.81-.33-21.55-0.46v0c-42.51-1.87-74.24-9.27-74.24-18.13s31.73-16.25,74.24-18.15v28.91c2.78,0.2,10.74.67,21.74,0.67,13.2,0,19.81-.55,21-0.66v-28.9c42.42,1.89,74.08,9.29,74.08,18.13s-31.65,16.24-74.08,18.12h0Zm0-39.25V79.68h59.2V40.23H89.21V79.68h59.19v25.86c-48.11,2.21-84.29,11.74-84.29,23.16s36.18,20.94,84.29,23.16v82.9h42.78v-82.93c48-2.21,84.12-11.73,84.12-23.14s-36.09-20.93-84.12-23.15h0Z" />
                          </svg>
                        </div>
                        {/* Swap arrows */}
                        <div className="flex flex-col items-center gap-0.5">
                          <ArrowLeftRight className="w-5 h-5 md:w-7 md:h-7 text-orange-500/70" />
                        </div>
                        {/* Bitcoin Coin - Right - Glossy Orange Glass */}
                        <div
                          className="instant-coin-right w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center shadow-xl relative"
                          style={{
                            perspective: "1000px",
                            transformStyle: "preserve-3d",
                            background:
                              "linear-gradient(135deg, rgba(251,146,60,0.95) 0%, rgba(249,115,22,0.85) 50%, rgba(194,65,12,0.95) 100%)",
                            boxShadow:
                              "0 8px 32px rgba(249,115,22,0.3), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            backdropFilter: "blur(8px)",
                          }}
                        >
                          <div
                            className="absolute inset-1 rounded-full"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)",
                            }}
                          />
                          {/* Bitcoin Logo */}
                          <BitcoinIcon className="relative w-7 h-7 md:w-9 md:h-9 [&_path]:fill-white" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-base md:text-lg font-semibold text-foreground">
                        Instant
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground mt-0.5">
                        Near-instant settlement
                      </div>
                    </div>
                  </div>
                </div>

                {/* Atomic Swaps - Peer to Peer Connection */}
                <div className="group relative md:col-span-2 aspect-[4/3] md:aspect-auto overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-orange-500/5 p-4 md:p-6 shadow-sm transition-all duration-300 hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-transparent to-orange-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <style>{`
                    .p2p-line {
                      stroke-dasharray: 4 4;
                      transition: all 0.4s ease;
                    }
                    .group:hover .p2p-line {
                      stroke-dasharray: none;
                      stroke-width: 2;
                      filter: drop-shadow(0 0 4px rgba(249,115,22,0.6));
                    }
                    .p2p-node {
                      transition: all 0.3s ease;
                    }
                    .group:hover .p2p-node {
                      filter: drop-shadow(0 0 12px rgba(249,115,22,0.5));
                      transform: scale(1.05);
                    }
                    .p2p-check {
                      opacity: 0;
                      transform: scale(0.5);
                      transition: all 0.3s ease 0.2s;
                    }
                    .group:hover .p2p-check {
                      opacity: 1;
                      transform: scale(1);
                    }
                  `}</style>
                  <div className="relative h-full flex flex-col justify-between">
                    {/* Peer-to-Peer Connection Visualization */}
                    <div className="flex-1 flex items-center justify-center py-4">
                      <div className="flex items-center gap-4 md:gap-8">
                        {/* Left Node - You */}
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className="p2p-node w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center relative"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(251,146,60,0.9) 0%, rgba(249,115,22,0.85) 50%, rgba(234,88,12,0.9) 100%)",
                              boxShadow:
                                "0 4px 20px rgba(249,115,22,0.25), inset 0 1px 2px rgba(255,255,255,0.2)",
                              border: "1px solid rgba(255,255,255,0.15)",
                            }}
                          >
                            <Key className="w-6 h-6 md:w-7 md:h-7 text-white" />
                          </div>
                          <span className="text-[10px] md:text-xs text-muted-foreground font-medium">
                            You
                          </span>
                        </div>

                        {/* Connection Line with Checkmark */}
                        <div className="relative flex items-center">
                          <svg
                            width="80"
                            height="40"
                            viewBox="0 0 80 40"
                            className="md:w-[120px]"
                            aria-hidden="true"
                          >
                            {/* Dashed connection line */}
                            <line
                              x1="0"
                              y1="20"
                              x2="80"
                              y2="20"
                              className="p2p-line"
                              stroke="#f97316"
                              strokeWidth="1.5"
                            />
                            {/* Center checkmark circle */}
                            <g
                              className="p2p-check"
                              style={{ transformOrigin: "40px 20px" }}
                            >
                              <circle cx="40" cy="20" r="12" fill="#f97316" />
                              <path
                                d="M34 20 L38 24 L46 16"
                                stroke="white"
                                strokeWidth="2"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </g>
                          </svg>
                        </div>

                        {/* Right Node - Peer */}
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className="p2p-node w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(251,146,60,0.9) 0%, rgba(249,115,22,0.85) 50%, rgba(234,88,12,0.9) 100%)",
                              boxShadow:
                                "0 4px 20px rgba(249,115,22,0.25), inset 0 1px 2px rgba(255,255,255,0.2)",
                              border: "1px solid rgba(255,255,255,0.15)",
                            }}
                          >
                            <Shield className="w-6 h-6 md:w-7 md:h-7 text-white" />
                          </div>
                          <span className="text-[10px] md:text-xs text-muted-foreground font-medium">
                            Peer
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Text content */}
                    <div>
                      <div className="text-base md:text-lg font-semibold text-foreground">
                        Atomic Swaps
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground mt-0.5">
                        Trustless · Self-custodial
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAQ Section - Only show on home page */}
          {isHomePage && (
            <div className="mx-auto max-w-2xl mt-24">
              <h3 className="text-xl font-semibold mb-6 text-center">
                Frequently Asked Questions
              </h3>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="how" className="border-border/50">
                  <AccordionTrigger className="text-left">
                    How does it work?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    LendaSwap uses Hash Time-Locked Contracts (HTLCs) to enable
                    trustless atomic swaps. When you start a swap, both parties
                    lock their funds in smart contracts. The swap either
                    completes fully or both parties get refunded - there's no
                    way for anyone to steal your funds. We support Bitcoin
                    Lightning, Arkade (Bitcoin L2), and EVM chains like Polygon
                    and Ethereum.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="custody" className="border-border/50">
                  <AccordionTrigger className="text-left">
                    Is LendaSwap self-custodial?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Yes! LendaSwap is fully self-custodial. Your keys, your
                    coins. You can backup your recovery phrase anytime by
                    clicking the key icon in the header - you can show,
                    download, or import your seedphrase. Store it safely - this
                    phrase allows you to recover your funds if anything goes
                    wrong.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="limits" className="border-border/50">
                  <AccordionTrigger className="text-left">
                    What is the maximum swap amount?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    In general, you can swap $1-$1000 USD without any problems.
                    For larger amounts, please contact us directly to confirm
                    availability.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="stuck" className="border-border/50">
                  <AccordionTrigger className="text-left">
                    What if my swap gets stuck?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    LendaSwap uses atomic swaps, which means your funds are
                    always safe. If a swap doesn't complete, you can always
                    recover your funds. Click the swap icon in the header to
                    view your swap history and initiate a refund if needed.
                    Note: depending on the swap currency, lock times may vary.
                    In the worst case, your funds might be locked for up to 2
                    weeks before you can claim them back.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="opensource" className="border-border/50">
                  <AccordionTrigger className="text-left">
                    Is LendaSwap open source?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Yes! LendaSwap is fully open source. You can review our
                    code, contribute, or run your own instance. Check out our
                    GitHub at{" "}
                    <a
                      href="https://github.com/lendasat/lendaswap-sdk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      github.com/lendasat/lendaswap
                    </a>
                    .
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-16 border-t">
          <div className="container mx-auto px-6 py-6">
            {/* Debug Navigation */}
            <DebugNavigation />

            <div className="text-muted-foreground text-center text-sm space-y-2">
              <p>© 2026 LendaSwap. All rights reserved.</p>
              <p>
                <button
                  type="button"
                  onClick={() => navigate("/terms")}
                  className="underline hover:text-foreground transition-colors"
                >
                  Terms of Service
                </button>
              </p>
            </div>
          </div>
        </footer>

        {/* Referral Code Dialog */}
        <ReferralCodeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCodeAdded={() => setHasCode(true)}
        />

        {/* Wallet Management Dialogs */}
        <BackupMnemonicDialog
          open={backupDialogOpen}
          onOpenChange={setBackupDialogOpen}
        />
        <ImportMnemonicDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportSuccess={() => {
            // Optionally refresh the page or show a success message
            window.location.reload();
          }}
        />
      </div>
    </div>
  );
}
