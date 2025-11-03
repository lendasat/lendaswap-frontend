import {useEffect, useState} from "react";
import {
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useParams,
} from "react-router";
import "../assets/styles.css";
import {ConnectKitButton} from "connectkit";
import {Check, Loader, Menu, PiggyBank, Shield, Tag, Wrench, Zap} from "lucide-react";
import {Button} from "#/components/ui/button";
import {Card, CardContent} from "#/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {ReactComponent as LendasatBlack} from "../assets/lendasat_black.svg";
import {ReactComponent as LendasatGrey} from "../assets/lendasat_grey.svg";
import {api, type TokenId} from "./api";
import {AssetDropDown} from "./components/AssetDropDown";
import {BtcInput} from "./components/BtcInput";
import {DebugNavigation} from "./components/DebugNavigation";
import {ReferralCodeDialog} from "./components/ReferralCodeDialog";
import {UsdInput} from "./components/UsdInput";
import {
    ManageSwapPage,
    SwapProcessingPage,
    SwapSendPage,
    SwapSuccessPage,
    SwapsPage,
} from "./pages";
import {hasReferralCode} from "./utils/referralCode";
import {useTheme} from "./utils/theme-provider";
import {ThemeToggle} from "./utils/theme-toggle";
import {usePriceFeed} from "./PriceFeedContext";
import {AddressInput} from "./components/AddressInput";
import {getOrCreateBitcoinKeys} from "./utils/bitcoinKeys";

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
            navigate("/btc_lightning/usdc_pol", {replace: true});
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
    const [lastFieldEdited, setLastFieldEdited] = useState<"usd" | "btc">("usd")
    const [targetAddress, setTargetAddress] = useState("")
    const [addressValid, setAddressValid] = useState(false);
    const [isCreatingSwap, setIsCreatingSwap] = useState(false);
    const [swapError, setSwapError] = useState<string>("");

    // Get price feed from context
    const {getExchangeRate, isLoadingPrice, priceUpdate} = usePriceFeed();

    const exchangeRate = getExchangeRate(sourceAsset, targetAsset, Number.parseFloat(usdAmount));

    let displayedExchangeRate = exchangeRate;
    if (exchangeRate && (sourceAsset === 'usdc_pol' || sourceAsset === 'usdt_pol')) {
        displayedExchangeRate = 1 / exchangeRate;
    }

    useEffect(() => {
        if (isLoadingPrice || !exchangeRate) {
            return;
        }
        if (lastFieldEdited === "usd") {
            const usdAmountNumber = Number.parseFloat(usdAmount);
            const calculatedBtcAmount = exchangeRate && !Number.isNaN(usdAmountNumber) ? (usdAmountNumber / exchangeRate).toFixed(8) : "";
            setBitcoinAmount(calculatedBtcAmount);

        }
        if (lastFieldEdited === "btc") {
            const bitcoinAmountNumber = Number.parseFloat(bitcoinAmount);
            const calculatedUsdAmount = exchangeRate && !Number.isNaN(bitcoinAmountNumber) ? (bitcoinAmountNumber * exchangeRate).toFixed(2) : "";
            setUsdAmount(calculatedUsdAmount);
        }
    }, [exchangeRate, isLoadingPrice, lastFieldEdited, bitcoinAmount, usdAmount, priceUpdate]);


    const handleContinueToAddress = async () => {
        // Create swap and navigate to send bitcoin step
        if (!targetAddress || !usdAmount || !addressValid) {
            return;
        }

        try {
            setIsCreatingSwap(true);
            setSwapError("");

            // Generate random secret and hash it
            const secret = generateSecret();
            const hash_lock = await hashSecret(secret);

            // Get or create Bitcoin keys
            const {publicKey: refund_pk, privateKey: own_sk} =
                getOrCreateBitcoinKeys();

            // Create swap with backend
            const swap = await api.createSwap({
                polygon_address: targetAddress,
                usd_amount: parseFloat(usdAmount),
                target_token: targetAsset,
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
                                className="pr-52"
                            />
                        ) : (
                            <BtcInput
                                value={bitcoinAmount}
                                onChange={(v) => {
                                    setLastFieldEdited("btc");
                                    setBitcoinAmount(v);
                                }}
                                className="pr-52"
                            />
                        )}
                        <div
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-48"
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
                                        navigate(`/${asset}/${targetAsset}`, {replace: true});
                                        return;
                                    }

                                    if (
                                        (asset === "btc_arkade" || asset === "btc_lightning") &&
                                        (targetAsset === "usdc_pol" || targetAsset === "usdt_pol")
                                    ) {
                                        setSourceAsset(asset);
                                        setTargetAsset(targetAsset);
                                        navigate(`/${asset}/${targetAsset}`, {replace: true});
                                        return;
                                    }

                                    if (
                                        (asset === "usdc_pol" || asset === "usdt_pol") &&
                                        (targetAsset === "usdc_pol" || targetAsset === "usdt_pol")
                                    ) {
                                        setSourceAsset(asset);
                                        setTargetAsset("btc_arkade");
                                        navigate(`/${asset}/btc_arkade`, {replace: true});
                                        return;
                                    }

                                    if (
                                        (asset === "btc_arkade" || asset === "btc_lightning") &&
                                        (targetAsset === "btc_arkade" ||
                                            targetAsset === "btc_lightning")
                                    ) {
                                        setSourceAsset(asset);
                                        setTargetAsset("usdc_pol");
                                        navigate(`/${asset}/usdc_pol`, {replace: true});
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
                                className="pr-52"
                                isLoading={isLoadingPrice}
                            />
                        ) : (
                            <BtcInput
                                value={bitcoinAmount}
                                onChange={(v) => {
                                    setLastFieldEdited("btc");
                                    setBitcoinAmount(v);
                                }}
                                className="pr-52"
                                isLoading={isLoadingPrice}
                            />
                        )}
                        <div
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-48"
                            id={"targetAsset"}
                        >
                            <AssetDropDown
                                value={targetAsset}
                                onChange={(asset) => {
                                    navigate(`/${sourceAsset}/${asset}`, {replace: true});
                                    setTargetAsset(asset);
                                }}
                                availableAssets={availableTargetAssets}
                            />
                        </div>
                    </div>
                    {displayedExchangeRate && !isLoadingPrice && (
                        <div className="text-sm text-muted-foreground text-center mt-2">
                            1 {sourceAsset === "btc_lightning" || sourceAsset === "btc_arkade" ? "BTC" : "USD"} = {
                            displayedExchangeRate.toLocaleString("en-US", {
                                minimumFractionDigits: sourceAsset === "btc_lightning" || sourceAsset === "btc_arkade" ? 2 : 8,
                                maximumFractionDigits: sourceAsset === "btc_lightning" || sourceAsset === "btc_arkade" ? 2 : 8,
                            })} {targetAsset === "btc_lightning" || targetAsset === "btc_arkade" ? "BTC" : "USD"}
                        </div>
                    )}
                    <AddressInput
                        value={targetAddress}
                        onChange={setTargetAddress}
                        targetToken={targetAsset}
                        setAddressIsValid={setAddressValid}
                    />
                    <Button
                        onClick={handleContinueToAddress}
                        disabled={!targetAddress || !exchangeRate || isLoadingPrice || !addressValid || isCreatingSwap}
                        className="w-full min-h-[4.25rem]"
                    >
                        {isCreatingSwap ? (
                            <>
                                <Loader className="animate-spin h-4 w-4"/>
                                Please Wait
                            </>
                        ) : (
                            <>
                                Continue
                            </>
                        )}
                    </Button>

                    {/* Swap Error Display */}
                    {swapError && (
                        <div
                            className="bg-destructive/10 border-destructive/20 text-destructive rounded-lg border p-3 text-sm">
                            {swapError}
                        </div>
                    )}
                </div>
            </div>
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
    const {theme} = useTheme();
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
                            <div
                                className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black dark:bg-white">
                                {theme === "dark" ? (
                                    <LendasatBlack className="h-5 w-5 shrink-0"/>
                                ) : (
                                    <LendasatGrey className="h-5 w-5 shrink-0"/>
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
                                            <Menu className="h-4 w-4"/>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        {hasCode ? (
                                            <DropdownMenuItem disabled className="gap-2">
                                                <Check className="h-4 w-4 text-green-600 dark:text-green-400"/>
                                                <span className="text-green-600 dark:text-green-400 font-bold">
                          NO-FEE
                        </span>
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem
                                                onClick={() => setDialogOpen(true)}
                                                className="gap-2"
                                            >
                                                <Tag className="h-4 w-4"/>
                                                Add your code
                                            </DropdownMenuItem>
                                        )}

                                        <DropdownMenuItem
                                            onClick={() => navigate("/swaps")}
                                            className="gap-2"
                                        >
                                            <Wrench className="h-4 w-4"/>
                                            Manage Swaps
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator/>

                                        <ConnectKitButton.Custom>
                                            {({isConnected, show, truncatedAddress, ensName}) => {
                                                return (
                                                    <DropdownMenuItem onClick={show}>
                                                        {isConnected
                                                            ? (ensName ?? truncatedAddress)
                                                            : "Connect Wallet"}
                                                    </DropdownMenuItem>
                                                );
                                            }}
                                        </ConnectKitButton.Custom>

                                        <DropdownMenuSeparator/>

                                        <DropdownMenuItem asChild>
                                            <ThemeToggle/>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Desktop Buttons */}
                            <div className="hidden md:flex items-center gap-3">
                                {hasCode ? (
                                    <div
                                        className="flex items-center gap-2 rounded-lg bg-green-500/10 px-2 py-1.5 sm:px-3">
                                        <Check className="h-4 w-4 text-green-600 dark:text-green-400"/>
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
                                        <Tag className="h-4 w-4"/>
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
                                    <Wrench className="h-4 w-4"/>
                                </Button>
                                <ThemeToggle/>
                                <ConnectKitButton.Custom>
                                    {({isConnected, show, truncatedAddress, ensName}) => {
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
                    <DebugNavigation/>

                    {/* Step Card */}
                    <Card className="from-primary/5 to-card rounded-xl border bg-gradient-to-t shadow-sm">
                        <Routes>
                            <Route
                                path="/"
                                element={<Navigate to="/btc_lightning/usdc_pol" replace/>}
                            />
                            <Route path="/:sourceToken/:targetToken" element={<HomePage/>}/>
                            <Route path="/swap/:swapId/send" element={<SwapSendPage/>}/>
                            <Route
                                path="/swap/:swapId/processing"
                                element={<SwapProcessingPage/>}
                            />
                            <Route
                                path="/swap/:swapId/success"
                                element={<SwapSuccessPage/>}
                            />
                            <Route path="/swaps" element={<SwapsPage/>}/>
                            <Route path="/manage/:swapId" element={<ManageSwapPage/>}/>
                        </Routes>
                    </Card>

                    {/* Info Cards - Only show on home page */}
                    {isHomePage && (
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card className="from-primary/5 to-card rounded-xl border bg-gradient-to-t shadow-sm">
                                <CardContent
                                    className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-black dark:bg-white">
                                        <Zap className="h-5 w-5 text-white dark:text-black"/>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-2xl font-bold">&lt;30s</div>
                                        <div className="text-muted-foreground text-sm">Swaps</div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="from-primary/5 to-card rounded-xl border bg-gradient-to-t shadow-sm">
                                <CardContent
                                    className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-black dark:bg-white">
                                        <Shield className="h-5 w-5 text-white dark:text-black"/>
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
                                <CardContent
                                    className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-black dark:bg-white">
                                        <PiggyBank className="h-5 w-5 text-white dark:text-black"/>
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
