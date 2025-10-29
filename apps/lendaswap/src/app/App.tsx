import { useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router";
import "../assets/styles.css";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Shield, PiggyBank, Zap, Tag, Check, Wrench } from "lucide-react";
import { ReactComponent as LendasatBlack } from "../assets/lendasat_black.svg";
import { ReactComponent as LendasatGrey } from "../assets/lendasat_grey.svg";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { api } from "./api";
import { EnterAmountStep } from "./steps";
import {
  SwapSendPage,
  SwapProcessingPage,
  SwapSuccessPage,
  SwapsPage,
  ManageSwapPage,
} from "./pages";
import { DebugNavigation } from "./components/DebugNavigation";
import { ReferralCodeDialog } from "./components/ReferralCodeDialog";
import { hasReferralCode } from "./utils/referralCode";
import { getOrCreateBitcoinKeys } from "./utils/bitcoinKeys";
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

// Home page component (enter-amount step)
function HomePage() {
  const navigate = useNavigate();

  // State for home page
  const [bitcoinAmount, setBitcoinAmount] = useState("");
  const [usdcAmount, setUsdcAmount] = useState("");
  const [receiveAddress, setReceiveAddress] = useState("");
  const [isCreatingSwap, setIsCreatingSwap] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Real exchange rate from backend
  const [exchangeRate, setExchangeRate] = useState<number | null>();
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);

  // Fetch price on component mount
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setIsLoadingPrice(true);
        setPriceError(null);
        const price = await api.getPrice();
        setExchangeRate(price.usd_per_btc);
      } catch (error) {
        console.error("Failed to fetch price:", error);
        setPriceError(
          error instanceof Error ? error.message : "Failed to fetch price",
        );
      } finally {
        setIsLoadingPrice(false);
      }
    };

    fetchPrice();
    // Refresh price every 30 seconds
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleBitcoinChange = (value: string) => {
    setBitcoinAmount(value);
    const btcValue = parseFloat(value);
    if (
      !Number.isNaN(btcValue) &&
      exchangeRate !== null &&
      exchangeRate !== undefined
    ) {
      setUsdcAmount((btcValue * exchangeRate).toFixed(2));
    } else {
      setUsdcAmount("");
    }
  };

  const handleUsdcChange = (value: string) => {
    setUsdcAmount(value);
    const usdcValue = parseFloat(value);
    if (
      !Number.isNaN(usdcValue) &&
      exchangeRate !== null &&
      exchangeRate !== undefined
    ) {
      setBitcoinAmount((usdcValue / exchangeRate).toFixed(8));
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
    <EnterAmountStep
      usdcAmount={usdcAmount}
      bitcoinAmount={bitcoinAmount}
      exchangeRate={exchangeRate}
      isLoadingPrice={isLoadingPrice}
      priceError={priceError}
      receiveAddress={receiveAddress}
      setReceiveAddress={setReceiveAddress}
      handleUsdcChange={handleUsdcChange}
      handleBitcoinChange={handleBitcoinChange}
      handleContinueToAddress={handleContinueToAddress}
      isCreatingSwap={isCreatingSwap}
      swapError={swapError}
    />
  );
}

// Get step title and description based on current route
function useStepInfo() {
  const location = useLocation();

  if (location.pathname === "/") {
    return {
      title: "Swap Bitcoin to USDC",
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
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasCode, setHasCode] = useState(hasReferralCode());

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
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
              {hasCode ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-2 py-1.5 sm:px-3">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="hidden sm:inline text-sm font-bold text-green-600 dark:text-green-400">
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
                  <span className="hidden sm:inline">Add your code</span>
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
              <ConnectButton.Custom>
                {({
                  account,
                  chain,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                  mounted,
                }) => {
                  const ready = mounted;
                  const connected = ready && account && chain;

                  return (
                    <div
                      {...(!ready && {
                        "aria-hidden": true,
                        style: {
                          opacity: 0,
                          pointerEvents: "none",
                          userSelect: "none",
                        },
                      })}
                    >
                      {(() => {
                        if (!connected) {
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={openConnectModal}
                            >
                              <span className="sm:hidden">Connect</span>
                              <span className="hidden sm:inline">
                                Connect Wallet
                              </span>
                            </Button>
                          );
                        }

                        if (chain.unsupported) {
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={openChainModal}
                            >
                              Wrong network
                            </Button>
                          );
                        }

                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={openAccountModal}
                          >
                            {account.displayName}
                          </Button>
                        );
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
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
              <Route path="/" element={<HomePage />} />
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
          {location.pathname === "/" && (
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
