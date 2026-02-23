import { useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import "../assets/styles.css";
import { ArrowLeftRight, Zap } from "lucide-react";
import { Card } from "#/components/ui/card";
import isValidSpeedWalletContext from "../utils/speedWallet";
import { api } from "./api";
import { AppHeader } from "./components/AppHeader";
import { BackupMnemonicDialog } from "./components/BackupMnemonicDialog";
import { DebugNavigation } from "./components/DebugNavigation";
import { ImportMnemonicDialog } from "./components/ImportMnemonicDialog";
import { LandingSection } from "./components/LandingSection";
import { ReferralCodeDialog } from "./components/ReferralCodeDialog";
import { HomePage } from "./HomePage";
import { RefundPage, SwapsPage, TermsOfServicePage } from "./pages";
import { hasReferralCode } from "./utils/referralCode";
import { SwapWizardPage } from "./wizard";

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
        <AppHeader
          hasCode={hasCode}
          onBackupOpen={() => setBackupDialogOpen(true)}
          onImportOpen={() => setImportDialogOpen(true)}
          onDownloadSeedphrase={handleDownloadSeedphrase}
        />

        {/* Terms of Service - rendered outside constrained layout */}
        {location.pathname === "/terms" && <TermsOfServicePage />}

        {/* Main Content */}
        {location.pathname !== "/terms" && (
          <main className="container mx-auto px-4 sm:px-5 md:px-6 py-16">
            <div className="mx-auto max-w-2xl space-y-10">
              {/* Title */}
              <div className="text-center">
                {stepInfo.isHomePage ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground/60">
                      <Zap className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      <span className="font-sans text-xs md:text-sm font-semibold tracking-widest uppercase">
                        Lightning-fast
                      </span>
                    </div>
                    <h1 className="font-sans text-xl md:text-3xl font-bold tracking-tight flex items-center justify-center gap-2 md:gap-3 bg-gradient-to-b from-foreground to-foreground/40 bg-clip-text text-transparent">
                      <span>Bitcoin</span>
                      <ArrowLeftRight className="w-4 h-4 md:w-6 md:h-6 text-muted-foreground/30" />
                      <span>Stablecoins</span>
                    </h1>
                  </div>
                ) : (
                  <h2 className="font-sans text-2xl md:text-4xl font-bold tracking-tight leading-snug">
                    {stepInfo.title}
                  </h2>
                )}
                {stepInfo.description && (
                  <p className="text-muted-foreground mt-2">
                    {stepInfo.description}
                  </p>
                )}
              </div>

              {/* Step Card */}
              <div className="mx-auto max-w-lg">
                <Routes>
                  <Route
                    path="/swap/:swapId/wizard"
                    element={<SwapWizardPage />}
                  />
                  <Route path="/swap/:swapId/refund" element={<RefundPage />} />
                  <Route
                    path="*"
                    element={
                      <div className="group relative">
                        {/* Orange glow effect on hover */}
                        <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/0 opacity-0 blur-xl transition-all duration-500 group-hover:from-orange-500/10 group-hover:via-orange-400/8 group-hover:to-orange-500/10 group-hover:opacity-100" />
                        <Card className="relative rounded-3xl border border-border bg-gradient-to-br from-card via-card to-orange-500/5 shadow-sm !py-0 !gap-0">
                          <Routes>
                            <Route
                              path="/"
                              element={
                                <Navigate
                                  to="/lightning:BTC/polygon:USDC"
                                  replace
                                />
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

            {/* Stats, Features & FAQ - Only show on home page */}
            {isHomePage && <LandingSection />}
          </main>
        )}

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
