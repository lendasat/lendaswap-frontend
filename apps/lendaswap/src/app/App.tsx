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
import { ConnectKitButton } from "connectkit";
import { Check, Menu, PiggyBank, Shield, Tag, Wrench, Zap } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { ReactComponent as LendasatBlack } from "../assets/lendasat_black.svg";
import { ReactComponent as LendasatGrey } from "../assets/lendasat_grey.svg";
import { api, type TokenId } from "./api";
import { AssetDropDown } from "./components/AssetDropDown";
import { BtcInput } from "./components/BtcInput";
import { DebugNavigation } from "./components/DebugNavigation";
import { ReferralCodeDialog } from "./components/ReferralCodeDialog";
import { UsdInput } from "./components/UsdInput";
import { usePriceFeed } from "./PriceFeedContext";
import {
  ManageSwapPage,
  SwapProcessingPage,
  SwapSendPage,
  SwapSuccessPage,
  SwapsPage,
} from "./pages";
import { EnterAmountStep } from "./steps";
import { getOrCreateBitcoinKeys } from "./utils/bitcoinKeys";
import { hasReferralCode } from "./utils/referralCode";
import { useTheme } from "./utils/theme-provider";
import { ThemeToggle } from "./utils/theme-toggle";

// Generate a random 32-byte secret
function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generate SHA-256 hash of the secret
async function hashSecret(secret: string): Promise<string> {
  // Decode hex string to bytes
  const bytes = new Uint8Array(
    secret.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hashHex}`;
}

// Validate that the URL tokens are valid
function isValidTokenId(token: string | undefined): token is TokenId {
  return (
    token === "btc_lightning" ||
    token === "btc_arkade" ||
    token === "usdc_pol" ||
    token === "usdt_pol"
  );
}

// Home page component (enter-amount step)
function HomePage() {
  const navigate = useNavigate();
  const params = useParams<{ sourceToken?: string; targetToken?: string }>();

  // Read tokens from URL params, validate them
  const urlSourceToken = isValidTokenId(params.sourceToken)
    ? params.sourceToken
    : null;
  const urlTargetToken = isValidTokenId(params.targetToken)
    ? params.targetToken
    : null;

  // Redirect to default if invalid tokens in URL
  useEffect(() => {
    if (!urlSourceToken || !urlTargetToken) {
      navigate("/btc_lightning/usdc_pol", { replace: true });
    }
  }, [urlSourceToken, urlTargetToken, navigate]);

  // State for home page
  const [bitcoinAmount, setBitcoinAmount] = useState("");
  const [usdcAmount, setUsdcAmount] = useState("50");
  const [usdAsset, setUsdAsset] = useState<TokenId>("usdc_pol");
  const [btcAsset, setBtcAsset] = useState<TokenId>("btc_arkade");

  const [receiveAddress, setReceiveAddress] = useState("");
  const [sourceToken, setSourceTokenState] = useState<TokenId>(
    urlSourceToken || "btc_lightning",
  );
  const [targetToken, setTargetTokenState] = useState<TokenId>(
    urlTargetToken || "usdc_pol",
  );
  const [isCreatingSwap, setIsCreatingSwap] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [lastEditedField, setLastEditedField] = useState<"usd" | "btc">("usd");

  // Get price feed from context
  const { getExchangeRate, isLoadingPrice } = usePriceFeed();

  // Update URL when tokens change
  const setSourceToken = (token: TokenId) => {
    setSourceTokenState(token);
    if (
      (token === "btc_arkade" || token === "btc_lightning") &&
      (targetToken === "usdc_pol" || targetToken === "usdt_pol")
    ) {
      navigate(`/${token}/${targetToken}`, { replace: true });
    } else if (
      (token === "usdc_pol" || token === "usdt_pol") &&
      (targetToken === "btc_arkade" || targetToken === "btc_lightning")
    ) {
      navigate(`/${token}/${targetToken}`, { replace: true });
    } else if (token === "btc_arkade" || token === "btc_lightning") {
      setTargetToken("usdc_pol");
      navigate(`/${token}/usdc_pol`, { replace: true });
    } else if (token === "usdc_pol" || token === "usdt_pol") {
      setTargetToken("btc_arkade");
      navigate(`/${token}/btc_arkade`, { replace: true });
    }
  };

  const setTargetToken = (token: TokenId) => {
    setTargetTokenState(token);
    navigate(`/${sourceToken}/${token}`, { replace: true });
  };

  // Sync state when URL params change (for browser back/forward)
  useEffect(() => {
    if (urlSourceToken && urlSourceToken !== sourceToken) {
      setSourceTokenState(urlSourceToken);
    }
    if (urlTargetToken && urlTargetToken !== targetToken) {
      setTargetTokenState(urlTargetToken);
    }
  }, [urlSourceToken, urlTargetToken, sourceToken, targetToken]);

  // Calculate the other amount when price becomes available or changes
  useEffect(() => {
    if (!isLoadingPrice) {
      const isBtcSource =
        sourceToken === "btc_lightning" || sourceToken === "btc_arkade";

      if (lastEditedField === "usd" && usdcAmount) {
        // User edited USD amount, calculate the other side
        const usdValue = parseFloat(usdcAmount);
        if (!Number.isNaN(usdValue)) {
          const exchangeRate = getExchangeRate(
            sourceToken,
            targetToken,
            usdValue,
          );
          if (exchangeRate !== null && exchangeRate !== undefined) {
            if (isBtcSource) {
              // BTC -> USD: exchangeRate is USD per BTC, so divide USD by rate to get BTC
              setBitcoinAmount((usdValue / exchangeRate).toFixed(8));
            } else {
              // USD -> BTC: exchangeRate is BTC per USD, so multiply USD by rate to get BTC
              setBitcoinAmount((usdValue * exchangeRate).toFixed(8));
            }
          }
        }
      } else if (lastEditedField === "btc" && bitcoinAmount) {
        // User edited BTC amount, calculate the other side
        const btcValue = parseFloat(bitcoinAmount);
        if (!Number.isNaN(btcValue)) {
          const usdAmount = parseFloat(usdcAmount) || 1;
          const exchangeRate = getExchangeRate(
            sourceToken,
            targetToken,
            usdAmount,
          );
          if (exchangeRate !== null && exchangeRate !== undefined) {
            if (isBtcSource) {
              // BTC -> USD: exchangeRate is USD per BTC, so multiply BTC by rate to get USD
              setUsdcAmount((btcValue * exchangeRate).toFixed(2));
            } else {
              // USD -> BTC: exchangeRate is BTC per USD, so divide BTC by rate to get USD
              setUsdcAmount((btcValue / exchangeRate).toFixed(2));
            }
          }
        }
      }
    }
  }, [
    isLoadingPrice,
    getExchangeRate,
    sourceToken,
    targetToken,
    lastEditedField,
    usdcAmount,
    bitcoinAmount,
  ]);

  const handleBitcoinChange = (value: string) => {
    setBitcoinAmount(value);
    setLastEditedField("btc");
    const btcValue = parseFloat(value);
    const isBtcSource =
      sourceToken === "btc_lightning" || sourceToken === "btc_arkade";

    if (!Number.isNaN(btcValue)) {
      const usdAmount = parseFloat(usdcAmount) || 1;
      const exchangeRate = getExchangeRate(sourceToken, targetToken, usdAmount);
      if (exchangeRate !== null && exchangeRate !== undefined) {
        if (isBtcSource) {
          // BTC -> USD: exchangeRate is USD per BTC, so multiply BTC by rate to get USD
          setUsdcAmount((btcValue * exchangeRate).toFixed(2));
        } else {
          // USD -> BTC: exchangeRate is BTC per USD, so divide BTC by rate to get USD
          setUsdcAmount((btcValue / exchangeRate).toFixed(2));
        }
      } else {
        setUsdcAmount("");
      }
    } else {
      setUsdcAmount("");
    }
  };

  const handleUsdcChange = (value: string) => {
    setUsdcAmount(value);
    setLastEditedField("usd");
    const usdValue = parseFloat(value);
    const isBtcSource =
      sourceToken === "btc_lightning" || sourceToken === "btc_arkade";

    if (!Number.isNaN(usdValue)) {
      const exchangeRate = getExchangeRate(sourceToken, targetToken, usdValue);
      console.log(
        `Exchange rate: ${exchangeRate} for ${sourceToken} -> ${targetToken}`,
      );

      if (exchangeRate !== null && exchangeRate !== undefined) {
        if (isBtcSource) {
          // BTC -> USD: exchangeRate is USD per BTC, so divide USD by rate to get BTC
          setBitcoinAmount((usdValue / exchangeRate).toFixed(8));
        } else {
          // USD -> BTC: exchangeRate is BTC per USD, so multiply USD by rate to get BTC
          setBitcoinAmount((usdValue * exchangeRate).toFixed(8));
        }
      } else {
        setBitcoinAmount("");
      }
    } else {
      setBitcoinAmount("");
    }
  };

  const handleContinueToAddress = async () => {
    // Create swap and navigate to send bitcoin step
    if (!receiveAddress || !usdcAmount) {
      return;
    }

    try {
      setIsCreatingSwap(true);
      setSwapError(null);

      // Generate random secret and hash it
      const secret = generateSecret();
      const hash_lock = await hashSecret(secret);

      // Get or create Bitcoin keys
      const { publicKey: refund_pk, privateKey: own_sk } =
        getOrCreateBitcoinKeys();

      // Create swap with backend
      const swap = await api.createSwap({
        polygon_address: receiveAddress,
        usd_amount: parseFloat(usdcAmount),
        target_token: targetToken,
        hash_lock,
        refund_pk,
      });

      console.log(
        "Persisting swap data",
        JSON.stringify({
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
          vhtlc_address: swap.arkade_address,
        }),
      );

      // Store complete swap data in browser storage for potential refunding
      localStorage.setItem(
        swap.id,
        JSON.stringify({
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
          vhtlc_address: swap.arkade_address,
        }),
      );

      // Navigate to send step with swap ID
      navigate(`/swap/${swap.id}/send`);
    } catch (error) {
      console.error("Failed to create swap:", error);
      setSwapError(
        error instanceof Error ? error.message : "Failed to create swap",
      );
    } finally {
      setIsCreatingSwap(false);
    }
  };

  return (
    <>
      {sourceToken === "usdc_pol" || sourceToken === "usdt_pol" ? (
        <>
          <div className={"flex flex-row gap-2"}>
            <UsdInput value={usdcAmount} onChange={setUsdcAmount} />
            <AssetDropDown value={usdAsset} onChange={setUsdAsset} />
          </div>
          <div className={"flex flex-row gap-2"}>
            <BtcInput value={bitcoinAmount} onChange={setBitcoinAmount} />
            <AssetDropDown value={btcAsset} onChange={setBtcAsset} />
          </div>
        </>
      ) : (
        <>
          <BtcInput value={bitcoinAmount} onChange={setBitcoinAmount} />
          <UsdInput value={usdcAmount} onChange={setUsdcAmount} />
        </>
      )}
      <EnterAmountStep
        usdcAmount={usdcAmount}
        bitcoinAmount={bitcoinAmount}
        receiveAddress={receiveAddress}
        sourceToken={sourceToken}
        targetToken={targetToken}
        setSourceToken={setSourceToken}
        setTargetToken={setTargetToken}
        setReceiveAddress={setReceiveAddress}
        handleUsdcChange={handleUsdcChange}
        handleBitcoinChange={handleBitcoinChange}
        handleContinueToAddress={handleContinueToAddress}
        isCreatingSwap={isCreatingSwap}
        swapError={swapError}
      />
    </>
  );
}

// Get step title and description based on current route
function useStepInfo() {
  const location = useLocation();

  // Check if on home page (token pair route like /btc_lightning/usdc_pol)
  const isHomePage =
    location.pathname === "/" || /^\/[^/]+\/[^/]+$/.test(location.pathname);

  if (isHomePage) {
    return {
      title: "Swap Bitcoin to USDC/USDT",
      description:
        "Fast, secure, and transparent swapping with the lowest rates on the market",
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
  const [hasCode, setHasCode] = useState(hasReferralCode());

  // Check if on home page (token pair route like /btc_lightning/usdc_pol)
  const isHomePage =
    location.pathname === "/" || /^\/[^/]+\/[^/]+$/.test(location.pathname);

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black dark:bg-white">
                {theme === "dark" ? (
                  <LendasatBlack className="h-5 w-5 shrink-0" />
                ) : (
                  <LendasatGrey className="h-5 w-5 shrink-0" />
                )}
              </div>
              <h1 className="text-xl font-semibold">LendaSwap</h1>
            </button>
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
                      <Wrench className="h-4 w-4" />
                      Manage Swaps
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <ConnectKitButton.Custom>
                      {({ isConnected, show, truncatedAddress, ensName }) => {
                        return (
                          <DropdownMenuItem onClick={show}>
                            {isConnected
                              ? (ensName ?? truncatedAddress)
                              : "Connect Wallet"}
                          </DropdownMenuItem>
                        );
                      }}
                    </ConnectKitButton.Custom>

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
                  title="Manage Swaps"
                >
                  <Wrench className="h-4 w-4" />
                </Button>
                <ThemeToggle />
                <ConnectKitButton.Custom>
                  {({ isConnected, show, truncatedAddress, ensName }) => {
                    return (
                      <Button variant="outline" size="sm" onClick={show}>
                        {isConnected
                          ? (ensName ?? truncatedAddress)
                          : "Connect Wallet"}
                      </Button>
                    );
                  }}
                </ConnectKitButton.Custom>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Title */}
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-semibold">{stepInfo.title}</h2>
            <p className="text-muted-foreground">{stepInfo.description}</p>
          </div>

          {/* Debug Navigation */}
          <DebugNavigation />

          {/* Step Card */}
          <Card className="from-primary/5 to-card rounded-xl border bg-gradient-to-t shadow-sm">
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/btc_lightning/usdc_pol" replace />}
              />
              <Route path="/:sourceToken/:targetToken" element={<HomePage />} />
              <Route path="/swap/:swapId/send" element={<SwapSendPage />} />
              <Route
                path="/swap/:swapId/processing"
                element={<SwapProcessingPage />}
              />
              <Route
                path="/swap/:swapId/success"
                element={<SwapSuccessPage />}
              />
              <Route path="/swaps" element={<SwapsPage />} />
              <Route path="/manage/:swapId" element={<ManageSwapPage />} />
            </Routes>
          </Card>

          {/* Info Cards - Only show on home page */}
          {isHomePage && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="from-primary/5 to-card rounded-xl border bg-gradient-to-t shadow-sm">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black dark:bg-white">
                    <Zap className="h-5 w-5 text-white dark:text-black" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">&lt;30s</div>
                    <div className="text-muted-foreground text-sm">Swaps</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="from-primary/5 to-card rounded-xl border bg-gradient-to-t shadow-sm">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black dark:bg-white">
                    <Shield className="h-5 w-5 text-white dark:text-black" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">Atomic Swap</div>
                    <div className="text-muted-foreground text-xs">
                      Succeed or refund atomically
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="from-primary/5 to-card rounded-xl border bg-gradient-to-t shadow-sm">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black dark:bg-white">
                    <PiggyBank className="h-5 w-5 text-white dark:text-black" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">0%</div>
                    <div className="text-muted-foreground text-sm">
                      fees-taken
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t">
        <div className="container mx-auto px-6 py-6">
          <div className="text-muted-foreground text-center text-sm">
            <p>© 2025 LendaSwap. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Referral Code Dialog */}
      <ReferralCodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCodeAdded={() => setHasCode(true)}
      />
    </div>
  );
}
