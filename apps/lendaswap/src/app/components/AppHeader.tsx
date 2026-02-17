import { ConnectKitButton } from "connectkit";
import {
  ArrowLeftRight,
  Check,
  Download,
  Eye,
  Github,
  Globe,
  Key,
  Menu,
  Upload,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import lendasatLogoBlack from "../../assets/lendasat_black.svg?url";
import lendasatLogoWhite from "../../assets/lendasat_grey.svg?url";
import { ReactComponent as XLogo } from "../../assets/x-com-logo.svg";
import isValidSpeedWalletContext from "../../utils/speedWallet";
import { useTheme } from "../utils/theme-provider";
import { ThemeToggle } from "../utils/theme-toggle";

interface AppHeaderProps {
  hasCode: boolean;
  onBackupOpen: () => void;
  onImportOpen: () => void;
  onDownloadSeedphrase: () => void;
}

export function AppHeader({
  hasCode,
  onBackupOpen,
  onImportOpen,
  onDownloadSeedphrase,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <header className="border-b">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <img
                src={theme === "dark" ? lendasatLogoWhite : lendasatLogoBlack}
                alt="LendaSat"
                className="size-8 shrink-0 rounded-lg object-contain"
              />
              <span className="text-xl font-semibold">LendaSwap</span>
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
              <XLogo className="w-4 h-4 fill-current" />
            </a>

            {/* Lendasat Website Link */}
            <a
              href="https://lendasat.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/50 transition-colors text-foreground hover:text-foreground"
              aria-label="Visit lendasat.com"
            >
              <Globe className="w-[18px] h-[18px]" />
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
                  {hasCode && (
                    <DropdownMenuItem disabled className="gap-2">
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-green-600 dark:text-green-400 font-bold">
                        NO-FEE
                      </span>
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

                  <DropdownMenuItem onClick={onBackupOpen} className="gap-2">
                    <Eye className="h-4 w-4" />
                    Show Seedphrase
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={onDownloadSeedphrase}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Seedphrase
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={onImportOpen} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import Seedphrase
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Hide Connect button in Speed Wallet - not needed */}
                  {!isValidSpeedWalletContext() && (
                    <ConnectKitButton.Custom>
                      {({ isConnected, show, truncatedAddress, ensName }) => {
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
              {hasCode && (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-2 py-1.5 sm:px-3">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                    NO-FEE
                  </span>
                </div>
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
                  <DropdownMenuItem onClick={onBackupOpen} className="gap-2">
                    <Eye className="h-4 w-4" />
                    Show Seedphrase
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onDownloadSeedphrase}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Seedphrase
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onImportOpen} className="gap-2">
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
  );
}
