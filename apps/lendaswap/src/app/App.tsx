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
import {
  Check,
  Loader,
  Menu,
  PiggyBank,
  Shield,
  Tag,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { useAccount } from "wagmi";
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
import { ReactComponent as XLogo } from "../assets/x-com-logo.svg";
import { api, type TokenId } from "./api";
import { AddressInput } from "./components/AddressInput";
import { AssetDropDown } from "./components/AssetDropDown";
import { BtcInput } from "./components/BtcInput";
import { DebugNavigation } from "./components/DebugNavigation";
import {
  FirstTimeBackupModal,
  hasAcknowledgedBackup,
} from "./components/FirstTimeBackupModal";
import { ReferralCodeDialog } from "./components/ReferralCodeDialog";
import { UsdInput } from "./components/UsdInput";
import { VersionFooter } from "./components/VersionFooter";
import { usePriceFeed } from "./PriceFeedContext";
import { SwapsPage, RefundPage } from "./pages";
import { SwapWizardPage } from "./wizard";
import { deriveSwapParams } from "@frontend/browser-wallet";
import { hasReferralCode } from "./utils/referralCode";
import { useTheme } from "./utils/theme-provider";
import { ThemeToggle } from "./utils/theme-toggle";
import { addSwap } from "./db";
import { useWalletBridge } from "./WalletBridgeContext";

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
  const { address: connectedAddress, isConnected } = useAccount();

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
  const [usdAmount, setUsdAmount] = useState("50");
  const [sourceAsset, setSourceAsset] = useState<TokenId>(
    urlSourceToken || "usdc_pol",
  );
  const [targetAsset, setTargetAsset] = useState<TokenId>(
    urlTargetToken || "btc_arkade",
  );
  const [lastFieldEdited, setLastFieldEdited] = useState<"usd" | "btc">("usd");
  const [targetAddress, setTargetAddress] = useState("");
  const [addressValid, setAddressValid] = useState(false);
  const [isCreatingSwap, setIsCreatingSwap] = useState(false);
  const [swapError, setSwapError] = useState<string>("");
  const [userPolygonAddress, setUserPolygonAddress] = useState<string>("");
  const [isPolygonAddressValid, setIsPolygonAddressValid] = useState(false);
  const [showFirstTimeBackupModal, setShowFirstTimeBackupModal] =
    useState(false);
  const { arkAddress, isEmbedded } = useWalletBridge();

  // Auto-populate Polygon address from connected wallet
  useEffect(() => {
    if (isConnected && connectedAddress) {
      setUserPolygonAddress(connectedAddress);
      setIsPolygonAddressValid(true);
    } else {
      setUserPolygonAddress("");
      setIsPolygonAddressValid(false);
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

  // Get price feed from context
  const { getExchangeRate, isLoadingPrice } = usePriceFeed();

  const exchangeRate = getExchangeRate(
    sourceAsset,
    targetAsset,
    Number.parseFloat(usdAmount),
  );

  let displayedExchangeRate = exchangeRate;
  if (
    exchangeRate &&
    (sourceAsset === "usdc_pol" || sourceAsset === "usdt_pol")
  ) {
    displayedExchangeRate = 1 / exchangeRate;
  }

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

  const handleContinueToAddress = async () => {
    // Create swap and navigate to send bitcoin step
    if (!targetAddress || !usdAmount || !addressValid) {
      return;
    }

    // Check if user has acknowledged backup - show modal if not
    if (!hasAcknowledgedBackup()) {
      setShowFirstTimeBackupModal(true);
      return;
    }

    // Proceed with swap creation
    await createSwap();
  };

  // Separate function for actual swap creation (called after backup modal is dismissed)
  const createSwap = async () => {
    try {
      setIsCreatingSwap(true);
      setSwapError("");

      // Detect swap direction
      const isBtcSource =
        sourceAsset === "btc_arkade" || sourceAsset === "btc_lightning";
      const isPolygonSource =
        sourceAsset === "usdc_pol" || sourceAsset === "usdt_pol";

      if (isBtcSource) {
        // BTC → Polygon

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

        const swap = await api.createArkadeToPolygonSwap({
          target_address: targetAddress,
          target_amount: targetAmount,
          target_token: targetAsset,
          hash_lock,
          refund_pk,
          user_id,
        });

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

        navigate(`/swap/${swap.id}/wizard`);
      } else if (isPolygonSource) {
        // Polygon → Bitcoin

        // Validate Polygon address
        if (!isPolygonAddressValid) {
          setSwapError("Please provide a valid Polygon wallet address");
          return;
        }

        if (targetAsset === "btc_arkade") {
          // Polygon → Arkade

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

          // Call Polygon → Arkade API
          const swap = await api.createPolygonToArkadeSwap({
            target_address: targetAddress, // Arkade address
            source_amount: parseFloat(usdAmount),
            source_token: sourceAsset,
            hash_lock,
            receiver_pk,
            user_polygon_address: userPolygonAddress,
            user_id,
          });

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

          // Navigate to Polygon signing page
          navigate(`/swap/${swap.id}/wizard`);
        }

        if (targetAsset === "btc_lightning") {
          // Polygon → Lightning

          // Then derive user ID from HD wallet (Polygon-Lightning doesn't need keys or hash).
          const { keyIndex: key_index, userId: user_id } =
            await deriveSwapParams();

          // Call Polygon → Lightning API
          const swap = await api.createPolygonToLightningSwap({
            bolt11_invoice: targetAddress,
            source_token: sourceAsset,
            user_polygon_address: userPolygonAddress,
            user_id,
          });

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

          // Navigate to Polygon signing page
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
    "usdc_pol",
    "usdt_pol",
    "btc_arkade",
    "btc_lightning",
  ];
  let availableTargetAssets: TokenId[];
  if (sourceAsset === "btc_lightning" || sourceAsset === "btc_arkade") {
    availableTargetAssets = ["usdc_pol", "usdt_pol"];
  } else {
    availableTargetAssets = ["btc_arkade", "btc_lightning"];
  }

  return (
    <>
      <div className="flex flex-col gap-2 px-4 md:px-4">
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">You send</label>
          <div className="relative">
            {sourceAsset === "usdc_pol" || sourceAsset === "usdt_pol" ? (
              <UsdInput
                value={usdAmount}
                onChange={(v) => {
                  setLastFieldEdited("usd");
                  setUsdAmount(v);
                }}
                className="pr-24 md:pr-32"
              />
            ) : (
              <BtcInput
                value={bitcoinAmount}
                onChange={(v) => {
                  setLastFieldEdited("btc");
                  setBitcoinAmount(v);
                }}
                className="pr-24 md:pr-32"
              />
            )}
            <div
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-20 md:w-28"
              id={"sourceAsset"}
            >
              <AssetDropDown
                value={sourceAsset}
                onChange={(asset) => {
                  if (
                    (asset === "usdc_pol" || asset === "usdt_pol") &&
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
                    (targetAsset === "usdc_pol" || targetAsset === "usdt_pol")
                  ) {
                    setSourceAsset(asset);
                    setTargetAsset(targetAsset);
                    navigate(`/${asset}/${targetAsset}`, { replace: true });
                    return;
                  }

                  if (
                    (asset === "usdc_pol" || asset === "usdt_pol") &&
                    (targetAsset === "usdc_pol" || targetAsset === "usdt_pol")
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
                availableAssets={availableSourceAssets}
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">You receive</label>
          <div className="relative">
            {targetAsset === "usdc_pol" || targetAsset === "usdt_pol" ? (
              <UsdInput
                value={usdAmount}
                onChange={(v) => {
                  setLastFieldEdited("usd");
                  setUsdAmount(v);
                }}
                className="pr-24 md:pr-32"
                isLoading={isLoadingPrice}
              />
            ) : (
              <BtcInput
                value={bitcoinAmount}
                onChange={(v) => {
                  setLastFieldEdited("btc");
                  setBitcoinAmount(v);
                }}
                className="pr-24 md:pr-32"
                isLoading={isLoadingPrice}
              />
            )}
            <div
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-20 md:w-28"
              id={"targetAsset"}
            >
              <AssetDropDown
                value={targetAsset}
                onChange={(asset) => {
                  navigate(`/${sourceAsset}/${asset}`, { replace: true });
                  setTargetAsset(asset);
                }}
                availableAssets={availableTargetAssets}
              />
            </div>
          </div>
          {displayedExchangeRate && !isLoadingPrice && (
            <div className="text-sm text-muted-foreground text-center mt-2">
              1{" "}
              {sourceAsset === "btc_lightning" || sourceAsset === "btc_arkade"
                ? "BTC"
                : "USD"}{" "}
              ={" "}
              {displayedExchangeRate.toLocaleString("en-US", {
                minimumFractionDigits:
                  sourceAsset === "btc_lightning" ||
                  sourceAsset === "btc_arkade"
                    ? 2
                    : 8,
                maximumFractionDigits:
                  sourceAsset === "btc_lightning" ||
                  sourceAsset === "btc_arkade"
                    ? 2
                    : 8,
              })}{" "}
              {targetAsset === "btc_lightning" || targetAsset === "btc_arkade"
                ? "BTC"
                : "USD"}
            </div>
          )}
          <AddressInput
            value={targetAddress}
            onChange={setTargetAddress}
            targetToken={targetAsset}
            setAddressIsValid={setAddressValid}
            setBitcoinAmount={(amount) => {
              setLastFieldEdited("btc");
              setBitcoinAmount(amount.toString());
            }}
            disabled={
              isEmbedded && !!arkAddress && targetAsset === "btc_arkade"
            }
          />

          {/* Polygon Wallet Address - only shown when source is Polygon stablecoin */}
          {(sourceAsset === "usdc_pol" || sourceAsset === "usdt_pol") && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Connect a Web3 wallet with POL tokens to pay for gas fees
              </label>
              {isConnected && userPolygonAddress ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={userPolygonAddress}
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
              ) : (
                <ConnectKitButton.Custom>
                  {({ show }) => (
                    <Button
                      variant="outline"
                      onClick={show}
                      className="w-full h-10 md:h-12 text-sm"
                    >
                      <Wallet className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                      Connect
                    </Button>
                  )}
                </ConnectKitButton.Custom>
              )}
              {!isConnected && (
                <p className="text-xs text-muted-foreground">
                  Connect your Polygon wallet to continue
                </p>
              )}
            </div>
          )}

          <div className="pt-2">
            <Button
              onClick={handleContinueToAddress}
              disabled={
                !targetAddress ||
                !exchangeRate ||
                isLoadingPrice ||
                !addressValid ||
                isCreatingSwap ||
                ((sourceAsset === "usdc_pol" || sourceAsset === "usdt_pol") &&
                  !isPolygonAddressValid)
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

      {/* First Time Backup Modal */}
      <FirstTimeBackupModal
        open={showFirstTimeBackupModal}
        onOpenChange={setShowFirstTimeBackupModal}
        onContinue={createSwap}
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
  const [hasCode, setHasCode] = useState(hasReferralCode());

  // Check if on home page (token pair route like /btc_lightning/usdc_pol)
  const isHomePage =
    location.pathname === "/" || /^\/[^/]+\/[^/]+$/.test(location.pathname);

  return (
    <div className="bg-background min-h-screen relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground) / 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground) / 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Modern Gradient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Top Left - Orange to Purple Gradient */}
        <div
          className="absolute -top-48 -left-48 w-[600px] h-[600px]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(251, 146, 60, 0.25) 0%, rgba(249, 115, 22, 0.15) 25%, rgba(234, 88, 12, 0.08) 50%, transparent 70%)",
            filter: "blur(100px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Top Left Secondary Layer */}
        <div
          className="absolute -top-32 -left-32 w-[500px] h-[500px]"
          style={{
            background:
              "radial-gradient(ellipse 80% 100% at 30% 30%, rgba(255, 137, 51, 0.2) 0%, rgba(251, 113, 133, 0.12) 40%, transparent 65%)",
            filter: "blur(80px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Bottom Right - Orange to Amber Gradient */}
        <div
          className="absolute -bottom-40 -right-40 w-[550px] h-[550px]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(251, 146, 60, 0.22) 0%, rgba(249, 115, 22, 0.14) 30%, rgba(245, 158, 11, 0.08) 50%, transparent 68%)",
            filter: "blur(110px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Center Right - Accent Glow */}
        <div
          className="absolute top-[35%] right-[15%] w-[450px] h-[450px]"
          style={{
            background:
              "radial-gradient(ellipse 90% 110% at 40% 50%, rgba(249, 115, 22, 0.18) 0%, rgba(251, 146, 60, 0.1) 35%, transparent 60%)",
            filter: "blur(120px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Left Middle - Subtle Purple-Orange Mix */}
        <div
          className="absolute top-[50%] -left-20 w-[400px] h-[400px]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(234, 88, 12, 0.15) 0%, rgba(249, 115, 22, 0.08) 40%, transparent 65%)",
            filter: "blur(90px)",
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

                {/* X/Twitter Link */}
                <a
                  href="https://x.com/lendasat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/50 transition-colors text-foreground hover:text-foreground"
                  aria-label="Follow us on X"
                >
                  <XLogo className="w-4 h-4 fill-current" />
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
                        <Wrench className="h-4 w-4" />
                        Manage Swaps
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <ConnectKitButton.Custom>
                        {({ isConnected, show, truncatedAddress, ensName }) => {
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

            {/* Step Card */}
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

            {/* Info Cards - Only show on home page */}
            {isHomePage && (
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="from-primary/5 to-card rounded-2xl border bg-gradient-to-t shadow-sm">
                  <CardContent className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black dark:bg-white">
                      <Zap className="h-5 w-5 text-white dark:text-black" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">Quick</div>
                      <div className="text-muted-foreground text-sm">
                        Don't blink
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="from-primary/5 to-card rounded-2xl border bg-gradient-to-t shadow-sm">
                  <CardContent className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black dark:bg-white">
                      <Shield className="h-5 w-5 text-white dark:text-black" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">Atomic</div>
                      <div className="text-muted-foreground text-sm">
                        Swap with confidence
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="from-primary/5 to-card rounded-2xl border bg-gradient-to-t shadow-sm">
                  <CardContent className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black dark:bg-white">
                      <PiggyBank className="h-5 w-5 text-white dark:text-black" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">0%</div>
                      <div className="text-muted-foreground text-sm">
                        Save on fees
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
            {/* Debug Navigation */}
            <DebugNavigation />

            <div className="space-y-3">
              <VersionFooter />
              <div className="text-muted-foreground text-center text-sm">
                <p>© 2025 LendaSwap. All rights reserved.</p>
              </div>
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
    </div>
  );
}
