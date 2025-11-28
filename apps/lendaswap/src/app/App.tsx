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
import { deriveSwapParams, getMnemonic } from "@frontend/browser-wallet";
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
  PiggyBank,
  Shield,
  Tag,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";
import { useAsync } from "react-use";
import { useAccount } from "wagmi";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "#/components/ui/accordion";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Skeleton } from "#/components/ui/skeleton";
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
  type TokenId,
} from "./api";
import { AddressInput } from "./components/AddressInput";
import { AssetDropDown } from "./components/AssetDropDown";
import { BackupMnemonicDialog } from "./components/BackupMnemonicDialog";
import { BtcInput } from "./components/BtcInput";
import { DebugNavigation } from "./components/DebugNavigation";
import { ImportMnemonicDialog } from "./components/ImportMnemonicDialog";
import { ReferralCodeDialog } from "./components/ReferralCodeDialog";
import { UsdInput } from "./components/UsdInput";
import { addSwap } from "./db";
import { usePriceFeed } from "./PriceFeedContext";
import { RefundPage, SwapsPage } from "./pages";
import { hasReferralCode } from "./utils/referralCode";
import { useTheme } from "./utils/theme-provider";
import { ThemeToggle } from "./utils/theme-toggle";
import {
  isEvmToken,
  isUsdToken,
  isValidTokenId,
  networkUrl,
} from "./utils/tokenUtils";
import { useWalletBridge } from "./WalletBridgeContext";
import { SwapWizardPage } from "./wizard";

// Home page component (enter-amount step)
function HomePage() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const params = useParams<{ sourceToken?: string; targetToken?: string }>();
  const { address: connectedAddress, isConnected } = useAccount();

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

  // State for home page
  const [bitcoinAmount, setBitcoinAmount] = useState("");
  const [usdAmount, setUsdAmount] = useState("50");
  const [sourceAsset, setSourceAsset] = useState<TokenId>(
    urlSourceToken || "usdc_pol",
  );
  const [targetAsset, setTargetAsset] = useState<TokenId>(
    urlTargetToken || (isSpeedWalletUser ? "btc_lightning" : "btc_arkade"),
  );
  const [lastFieldEdited, setLastFieldEdited] = useState<"usd" | "btc">("usd");
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

  // Auto-populate target address with arkAddress if embedded and target is btc_arkade
  useEffect(() => {
    if (
      isEmbedded &&
      arkAddress &&
      targetAsset === "btc_arkade" &&
      !targetAddress
    ) {
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
      targetAsset === "btc_lightning" &&
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
    Number.parseFloat(usdAmount),
  );

  let displayedExchangeRate = exchangeRate;
  if (exchangeRate && isEvmToken(sourceAsset)) {
    displayedExchangeRate = 1 / exchangeRate;
  }

  const {
    value: maybeAssetPairs,
    error: loadingTokensError,
    loading: isLoadingTokens,
  } = useAsync(async () => {
    return await api.getAssetPairs();
  });
  if (isLoadingTokens || loadingTokensError) {
    console.error("Failed loading tokens", loadingTokensError);
  }

  const assetPairs = maybeAssetPairs || [];

  useEffect(() => {
    if (isLoadingPrice || !exchangeRate) {
      return;
    }
    if (lastFieldEdited === "usd") {
      const usdAmountNumber = Number.parseFloat(usdAmount);
      const calculatedBtcAmount =
        exchangeRate && !Number.isNaN(usdAmountNumber)
          ? (usdAmountNumber / exchangeRate).toFixed(8)
          : "";
      setBitcoinAmount(calculatedBtcAmount);
    }
    if (lastFieldEdited === "btc") {
      const bitcoinAmountNumber = Number.parseFloat(bitcoinAmount);
      const calculatedUsdAmount =
        exchangeRate && !Number.isNaN(bitcoinAmountNumber)
          ? (bitcoinAmountNumber * exchangeRate).toFixed(2)
          : "";
      setUsdAmount(calculatedUsdAmount);
    }
  }, [exchangeRate, isLoadingPrice, lastFieldEdited, bitcoinAmount, usdAmount]);

  // Fetch quote when bitcoin amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      const btcAmount = Number.parseFloat(bitcoinAmount);
      if (!btcAmount || Number.isNaN(btcAmount) || btcAmount <= 0) {
        setQuote(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        // Convert BTC to satoshis
        const sats = Math.round(btcAmount * 100_000_000);
        const quoteResponse = await api.getQuote({
          from: sourceAsset,
          to: targetAsset,
          base_amount: sats,
        });
        setQuote(quoteResponse);
      } catch (error) {
        console.error("Failed to fetch quote:", error);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    fetchQuote();
  }, [bitcoinAmount, sourceAsset, targetAsset]);

  const handleContinueToAddress = async () => {
    if (!targetAddress || !usdAmount || !addressValid) {
      return;
    }

    await createSwap();
  };

  // Helper to track swap initiation
  const trackSwapInitiation = (swap: GetSwapResponse) => {
    const swapDirection =
      swap.source_token === "btc_arkade" ||
      swap.source_token === "btc_lightning"
        ? "btc-to-evm"
        : "evm-to-btc";
    posthog?.capture("swap_initiated", {
      swap_id: swap.id,
      swap_direction: swapDirection,
      source_token: swap.source_token,
      target_token: swap.target_token,
      amount_usd: swap.usd_amount,
      amount_sats: swap.sats_receive,
      has_referral_code: hasReferralCode(),
    });
  };

  const createSwap = async () => {
    try {
      setIsCreatingSwap(true);
      setSwapError("");

      // Detect swap direction
      const isBtcSource = !isEvmToken(sourceAsset);
      const isEvmSource = isEvmToken(sourceAsset);

      if (isBtcSource) {
        // BTC → EVM

        // Derive swap params (keypair + preimage hash) from HD wallet (this increments the index)
        const {
          ownSk: own_sk,
          ownPk: refund_pk,
          preimage: secret,
          preimageHash,
          userId: user_id,
          keyIndex: key_index,
        } = await deriveSwapParams();

        // Preimage hash is hex-encoded, need to prepend 0x for hash_lock
        const hash_lock = `0x${preimageHash}`;

        let targetAmount = parseFloat(usdAmount);
        if (targetAsset === "btc_arkade" || targetAsset === "btc_lightning") {
          targetAmount = parseFloat(bitcoinAmount);
        }

        const swap = await api.createArkadeToEvmSwap(
          {
            target_address: targetAddress,
            target_amount: targetAmount,
            target_token: targetAsset,
            hash_lock,
            refund_pk,
            user_id,
          },
          networkUrl(targetAsset),
        );

        console.log(
          "Persisting swap data",
          JSON.stringify({
            key_index,
            lendaswap_pk: swap.receiver_pk,
            arkade_server_pk: swap.server_pk,
            refund_locktime: swap.refund_locktime,
            unilateral_claim_delay: swap.unilateral_claim_delay,
            unilateral_refund_delay: swap.unilateral_refund_delay,
            unilateral_refund_without_receiver_delay:
              swap.unilateral_refund_without_receiver_delay,
            network: swap.network,
            vhtlc_address: swap.htlc_address_arkade,
          }),
        );

        localStorage.setItem(
          swap.id,
          JSON.stringify({
            key_index,
            secret,
            own_sk,
            lendaswap_pk: swap.receiver_pk,
            arkade_server_pk: swap.server_pk,
            refund_locktime: swap.refund_locktime,
            unilateral_claim_delay: swap.unilateral_claim_delay,
            unilateral_refund_delay: swap.unilateral_refund_delay,
            unilateral_refund_without_receiver_delay:
              swap.unilateral_refund_without_receiver_delay,
            network: swap.network,
            vhtlc_address: swap.htlc_address_arkade,
            created_at: swap.created_at,
            source_token: swap.source_token,
            target_token: swap.target_token,
          }),
        );

        // Store in Dexie as well (with additional sensitive fields)
        await addSwap({
          ...swap,
          secret,
          own_sk,
          refund_pk,
        });

        trackSwapInitiation(swap);
        navigate(`/swap/${swap.id}/wizard`);
      } else if (isEvmSource) {
        // EVM → Bitcoin

        // Validate EVM address
        if (!isEvmAddressValid) {
          setSwapError(`Please provide a valid wallet address`);
          return;
        }

        if (targetAsset === "btc_arkade") {
          // EVM → Arkade

          // Then derive swap params (keypair + preimage hash) from HD wallet (this increments the index)
          const {
            ownSk: own_sk,
            ownPk: receiver_pk,
            preimage: secret,
            preimageHash,
            userId: user_id,
            keyIndex: key_index,
          } = await deriveSwapParams();

          // Preimage hash is hex-encoded, need to prepend 0x for hash_lock
          const hash_lock = `0x${preimageHash}`;

          // Call EVM → Arkade API
          const swap = await api.createEvmToArkadeSwap(
            {
              target_address: targetAddress, // Arkade address
              source_amount: parseFloat(usdAmount),
              source_token: sourceAsset,
              hash_lock,
              receiver_pk,
              user_address: userEvmAddress,
              user_id,
            },
            networkUrl(sourceAsset),
          );

          // Store swap data (needed for claiming BTC later)
          localStorage.setItem(
            swap.id,
            JSON.stringify({
              key_index,
              secret,
              own_sk,
              receiver_pk,
              lendaswap_pk: swap.sender_pk,
              arkade_server_pk: swap.server_pk,
              refund_locktime: swap.refund_locktime,
              unilateral_claim_delay: swap.unilateral_claim_delay,
              unilateral_refund_delay: swap.unilateral_refund_delay,
              unilateral_refund_without_receiver_delay:
                swap.unilateral_refund_without_receiver_delay,
              network: swap.network,
              vhtlc_address: swap.htlc_address_arkade,
              created_at: swap.created_at,
              source_token: swap.source_token,
              target_token: swap.target_token,
            }),
          );

          // Store in Dexie as well (with additional sensitive fields)
          await addSwap({
            ...swap,
            secret,
            own_sk,
            receiver_pk,
          });

          trackSwapInitiation(swap);
          navigate(`/swap/${swap.id}/wizard`);
        }

        if (targetAsset === "btc_lightning") {
          // EVM → Lightning

          // Then derive user ID from HD wallet (EVM-Lightning doesn't need keys or hash).
          const { keyIndex: key_index, userId: user_id } =
            await deriveSwapParams();

          // Resolve Lightning address to BOLT11 invoice if needed
          let bolt11Invoice = targetAddress;
          if (isLightningAddress(targetAddress)) {
            try {
              const amountSats = parseFloat(bitcoinAmount) * 100_000_000; // Convert BTC to sats
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
              user_id,
            },
            networkUrl(sourceAsset),
          );

          // Store swap data
          localStorage.setItem(
            swap.id,
            JSON.stringify({
              key_index,
              lendaswap_pk: swap.sender_pk,
              arkade_server_pk: swap.server_pk,
              refund_locktime: swap.refund_locktime,
              unilateral_claim_delay: swap.unilateral_claim_delay,
              unilateral_refund_delay: swap.unilateral_refund_delay,
              unilateral_refund_without_receiver_delay:
                swap.unilateral_refund_without_receiver_delay,
              network: swap.network,
              vhtlc_address: swap.htlc_address_arkade,
              created_at: swap.created_at,
              source_token: swap.source_token,
              target_token: swap.target_token,
            }),
          );

          // Store in Dexie as well
          await addSwap(swap);

          trackSwapInitiation(swap);
          navigate(`/swap/${swap.id}/wizard`);
        }
      }
    } catch (error) {
      console.error("Failed to create swap:", error);
      setSwapError(
        error instanceof Error ? error.message : "Failed to create swap",
      );
    } finally {
      setIsCreatingSwap(false);
    }
  };

  const availableSourceAssets: TokenId[] = [
    ...new Set(
      assetPairs
        .map((a) => a.source.token_id)
        .sort((a, b) => a.localeCompare(b)),
    ),
  ];
  let availableTargetAssets: TokenId[];
  if (sourceAsset === "btc_lightning" || sourceAsset === "btc_arkade") {
    availableTargetAssets = [
      ...new Set(
        assetPairs
          .filter((a) => {
            return (
              a.target.token_id === "btc_arkade" ||
              a.target.token_id === "btc_lightning"
            );
          })
          .map((a) => {
            return a.source.token_id;
          })
          .sort((a, b) => a.localeCompare(b)),
      ),
    ];
  } else {
    availableTargetAssets = ["btc_arkade", "btc_lightning"];
  }

  // Helper to format display values
  const formatUsdDisplay = (val: string) => {
    if (!val || val === "") return "0";
    const num = Number.parseFloat(val);
    if (Number.isNaN(num)) return val;
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatBtcDisplay = (val: string) => {
    if (!val || val === "") return "0";
    const num = Number.parseFloat(val);
    if (Number.isNaN(num)) return val;
    return num.toFixed(8);
  };

  // Handle source amount input
  const handleSourceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/[^0-9.]/g, "");
    if (isUsdToken(sourceAsset)) {
      if (input === "" || /^\d*\.?\d{0,2}$/.test(input)) {
        setLastFieldEdited("usd");
        setUsdAmount(input);
      }
    } else {
      if (input === "" || /^\d*\.?\d{0,8}$/.test(input)) {
        setLastFieldEdited("btc");
        setBitcoinAmount(input);
      }
    }
  };

  // Handle target amount input
  const handleTargetInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/[^0-9.]/g, "");
    if (isUsdToken(targetAsset)) {
      if (input === "" || /^\d*\.?\d{0,2}$/.test(input)) {
        setLastFieldEdited("usd");
        setUsdAmount(input);
      }
    } else {
      if (input === "" || /^\d*\.?\d{0,8}$/.test(input)) {
        setLastFieldEdited("btc");
        setBitcoinAmount(input);
      }
    }
  };

  return (
    <div className="flex flex-col p-3">
      {/* Sell/Buy container with arrow */}
      <div className="relative">
        {/* Sell */}
        <div className="rounded-2xl bg-muted p-4 pb-5">
          <div className="text-sm text-muted-foreground mb-2">Sell</div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                inputMode="decimal"
                value={isUsdToken(sourceAsset) ? usdAmount : bitcoinAmount}
                onChange={handleSourceInput}
                placeholder="0"
                className="w-full bg-transparent text-4xl font-medium outline-none placeholder:text-muted-foreground/50"
                data-1p-ignore
                data-lpignore="true"
                autoComplete="off"
              />
              <div className="text-sm text-muted-foreground mt-1">
                {isUsdToken(sourceAsset) ? (
                  <span>≈ {formatBtcDisplay(bitcoinAmount)} BTC</span>
                ) : (
                  <span>≈ ${formatUsdDisplay(usdAmount)}</span>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <AssetDropDown
                value={sourceAsset}
                availableAssets={availableSourceAssets}
                label="sell"
                onChange={(asset) => {
                  if (
                    (asset === "usdc_pol" ||
                      asset === "usdt0_pol" ||
                      asset === "usdt_eth" ||
                      asset === "usdc_eth") &&
                    (targetAsset === "btc_arkade" ||
                      targetAsset === "btc_lightning")
                  ) {
                    setSourceAsset(asset);
                    setTargetAsset(targetAsset);
                    navigate(`/${asset}/${targetAsset}`, { replace: true });
                    return;
                  }

                  if (
                    (asset === "btc_arkade" || asset === "btc_lightning") &&
                    (targetAsset === "usdc_pol" ||
                      targetAsset === "usdt0_pol" ||
                      targetAsset === "usdc_eth" ||
                      targetAsset === "usdt_eth")
                  ) {
                    setSourceAsset(asset);
                    setTargetAsset(targetAsset);
                    navigate(`/${asset}/${targetAsset}`, { replace: true });
                    return;
                  }

                  if (
                    (asset === "usdc_pol" ||
                      asset === "usdt0_pol" ||
                      asset === "usdt_eth" ||
                      asset === "usdc_eth") &&
                    (targetAsset === "usdc_pol" ||
                      targetAsset === "usdt0_pol" ||
                      targetAsset === "usdc_eth" ||
                      targetAsset === "usdt_eth")
                  ) {
                    setSourceAsset(asset);
                    setTargetAsset("btc_arkade");
                    navigate(`/${asset}/btc_arkade`, { replace: true });
                    return;
                  }

                  if (
                    (asset === "btc_arkade" || asset === "btc_lightning") &&
                    (targetAsset === "btc_arkade" ||
                      targetAsset === "btc_lightning")
                  ) {
                    setSourceAsset(asset);
                    setTargetAsset("usdc_pol");
                    navigate(`/${asset}/usdc_pol`, { replace: true });
                    return;
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Arrow divider - absolutely positioned */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="bg-background rounded-xl p-1">
            <div className="bg-muted rounded-lg p-1.5">
              <ArrowDown className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Buy */}
        <div className="rounded-2xl bg-muted p-4 pt-5 mt-1">
        <div className="text-sm text-muted-foreground mb-2">Buy</div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isLoadingPrice ? (
              <div className="h-10 flex items-center">
                <Skeleton className="h-8 w-32" />
              </div>
            ) : (
              <input
                type="text"
                inputMode="decimal"
                value={isUsdToken(targetAsset) ? usdAmount : bitcoinAmount}
                onChange={handleTargetInput}
                placeholder="0"
                className="w-full bg-transparent text-4xl font-medium outline-none placeholder:text-muted-foreground/50"
                data-1p-ignore
                data-lpignore="true"
                autoComplete="off"
              />
            )}
            <div className="text-sm text-muted-foreground mt-1">
              {isUsdToken(targetAsset) ? (
                <span>≈ {formatBtcDisplay(bitcoinAmount)} BTC</span>
              ) : (
                <span>≈ ${formatUsdDisplay(usdAmount)}</span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <AssetDropDown
              value={targetAsset}
              onChange={(asset) => {
                navigate(`/${sourceAsset}/${asset}`, { replace: true });
                setTargetAsset(asset);
              }}
              availableAssets={availableTargetAssets}
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
            setLastFieldEdited("btc");
            setBitcoinAmount(amount.toString());
          }}
          disabled={isEmbedded && !!arkAddress && targetAsset === "btc_arkade"}
        />

        {/* EVM Wallet Address - only shown when source is EVM stablecoin (hidden in Speed Wallet) */}
        {isEvmToken(sourceAsset) && !isValidSpeedWalletContext() && (
          <div className="space-y-2">
            {isConnected && userEvmAddress ? (
              <>
                <label
                  htmlFor={"connect-address"}
                  className="text-sm text-muted-foreground"
                >
                  Wallet connected for gas fees
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={"connect-address"}
                    type="text"
                    value={userEvmAddress}
                    readOnly
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-muted cursor-not-allowed min-h-[3rem] md:min-h-[3.5rem]"
                  />
                  <ConnectKitButton.Custom>
                    {({ show }) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={show}
                        className="shrink-0"
                      >
                        Change
                      </Button>
                    )}
                  </ConnectKitButton.Custom>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Connect your wallet to continue
              </p>
            )}
          </div>
        )}

        {/* Fees - below inputs, above Continue button */}
        {isLoadingQuote ? (
          <div className="text-xs text-muted-foreground/70 pt-2 flex flex-wrap justify-between gap-y-0.5">
            <div className="flex items-center gap-1">
              Network Fee: <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex items-center gap-1">
              Protocol Fee: <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : quote ? (
          <div className="text-xs text-muted-foreground/70 pt-2 flex flex-wrap justify-between gap-y-0.5">
            <div>
              Network Fee: {(quote.network_fee / 100_000_000).toFixed(8)} BTC
            </div>
            <div>
              Protocol Fee: {(quote.protocol_fee / 100_000_000).toFixed(8)} BTC
              ({(quote.protocol_fee_rate * 100).toFixed(2)}%)
            </div>
          </div>
        ) : null}

        <div className="pt-2">
          <Button
            onClick={handleContinueToAddress}
            disabled={
              !targetAddress ||
              !exchangeRate ||
              isLoadingPrice ||
              !addressValid ||
              isCreatingSwap ||
              (isEvmToken(sourceAsset) && !isEvmAddressValid)
            }
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
        ? "⚡ Trustless Secure Instant Swaps"
        : "Trustless Secure Instant Swaps",
      description: "",
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
      const mnemonic = await getMnemonic();

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
          className="absolute -top-48 -left-48 w-[600px] h-[600px]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(251, 146, 60, 0.08) 0%, rgba(249, 115, 22, 0.05) 25%, rgba(234, 88, 12, 0.03) 50%, transparent 70%)",
            filter: "blur(100px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Bottom Right - Orange to Amber Gradient */}
        <div
          className="absolute -bottom-40 -right-40 w-[550px] h-[550px]"
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
                                {isConnected ? (
                                  (ensName ?? truncatedAddress)
                                ) : (
                                  <>
                                    <Wallet className="w-4 h-4 mr-2" />
                                    Connect
                                  </>
                                )}
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
                            {isConnected ? (
                              (ensName ?? truncatedAddress)
                            ) : (
                              <>
                                <Wallet className="w-3.5 h-3.5 mr-1.5" />
                                Connect
                              </>
                            )}
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
        <main className="container mx-auto px-6 py-16">
          <div className="mx-auto max-w-2xl space-y-10">
            {/* Title */}
            <div className="space-y-2 text-center">
              <h2 className="text-5xl font-semibold">{stepInfo.title}</h2>
              <p className="text-muted-foreground">{stepInfo.description}</p>
            </div>

            {/* Step Card */}
            <div className="mx-auto max-w-lg">
              <Routes>
                <Route path="/swap/:swapId/wizard" element={<SwapWizardPage />} />
                <Route path="/swap/:swapId/refund" element={<RefundPage />} />
                <Route
                  path="*"
                  element={
                    <Card className="from-primary/5 to-card rounded-2xl border bg-gradient-to-t shadow-sm">
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
                  }
                />
              </Routes>
            </div>

            {/* Stats & Features - Only show on home page */}
            {isHomePage && (
              <div className="mt-16 space-y-6">
                {/* Volume Stats */}
                <div className="flex items-center justify-center gap-8 text-center">
                  <div>
                    <div className="text-3xl font-bold tracking-tight">$20,000</div>
                    <div className="text-sm text-muted-foreground">Total Volume</div>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <div className="text-3xl font-bold tracking-tight">$1,000</div>
                    <div className="text-sm text-muted-foreground">24H Volume</div>
                  </div>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="group rounded-2xl border border-border/50 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card">
                    <div className="mb-2 inline-flex rounded-xl bg-orange-500/10 p-2.5">
                      <Zap className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="font-semibold">Instant</div>
                    <div className="text-sm text-muted-foreground">Near-instant settlement</div>
                  </div>
                  <div className="group rounded-2xl border border-border/50 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card">
                    <div className="mb-2 inline-flex rounded-xl bg-orange-500/10 p-2.5">
                      <Shield className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="font-semibold">Atomic Swaps</div>
                    <div className="text-sm text-muted-foreground">Trustless & secure</div>
                  </div>
                  <div className="group rounded-2xl border border-border/50 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card">
                    <div className="mb-2 inline-flex rounded-xl bg-orange-500/10 p-2.5">
                      <PiggyBank className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="font-semibold">0% Fees</div>
                    <div className="text-sm text-muted-foreground">No protocol fees</div>
                  </div>
                  <div className="group rounded-2xl border border-border/50 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card">
                    <div className="mb-2 inline-flex rounded-xl bg-orange-500/10 p-2.5">
                      <Key className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="font-semibold">Self-Custodial</div>
                    <div className="text-sm text-muted-foreground">Your keys, your coins</div>
                  </div>
                </div>
              </div>
            )}

            {/* FAQ Section - Only show on home page */}
            {isHomePage && (
              <div className="mt-24">
                <h3 className="text-xl font-semibold mb-6 text-center">
                  Frequently Asked Questions
                </h3>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="how" className="border-border/50">
                    <AccordionTrigger className="text-left">
                      How does it work?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      LendaSwap uses Hash Time-Locked Contracts (HTLCs) to
                      enable trustless atomic swaps. When you start a swap, both
                      parties lock their funds in smart contracts. The swap
                      either completes fully or both parties get refunded -
                      there's no way for anyone to steal your funds. We support
                      Bitcoin Lightning, Arkade (Bitcoin L2), and EVM chains
                      like Polygon and Ethereum.
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
                      download, or import your seedphrase. Store it safely -
                      this phrase allows you to recover your funds if anything
                      goes wrong.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="limits" className="border-border/50">
                    <AccordionTrigger className="text-left">
                      What is the maximum swap amount?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      In general, you can swap $1-$1000 USD without any
                      problems. For larger amounts, please contact us directly
                      to confirm availability.
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
                  <AccordionItem
                    value="opensource"
                    className="border-border/50"
                  >
                    <AccordionTrigger className="text-left">
                      Is LendaSwap open source?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Yes! LendaSwap is fully open source. You can review our
                      code, contribute, or run your own instance. Check out our
                      GitHub at{" "}
                      <a
                        href="https://github.com/lendasat/lendaswap"
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
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-16 border-t">
          <div className="container mx-auto px-6 py-6">
            {/* Debug Navigation */}
            <DebugNavigation />

            <div className="text-muted-foreground text-center text-sm">
              <p>
                © 2025 LendaSwap. All rights reserved.{" "}
                <a
                  href="https://lendasat.com/docs/tos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  Terms of Service
                </a>
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
