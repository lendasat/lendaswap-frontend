import { ConnectKitButton } from "connectkit";
import { isAddress } from "ethers";
import { ArrowDownUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "#/components/ui/button";
import { CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { ReactComponent as BitcoinIcon } from "../../assets/bitcoin.svg";
import { ReactComponent as LightningIcon } from "../../assets/bitcoin_lightning.svg";
import { ReactComponent as UsdcIcon } from "../../assets/usdc.svg";
import { ReactComponent as TetherIcon } from "../../assets/usdt0.svg";
import type { AssetPair, TokenId } from "../api";
import { api } from "../api";
import { usePriceFeed } from "../PriceFeedContext";

interface EnterAmountStepProps {
  usdcAmount: string;
  bitcoinAmount: string;
  receiveAddress: string;
  sourceToken: TokenId;
  targetToken: TokenId;
  setSourceToken: (token: TokenId) => void;
  setTargetToken: (token: TokenId) => void;
  setReceiveAddress: (value: string) => void;
  handleUsdcChange: (value: string) => void;
  handleBitcoinChange: (value: string) => void;
  handleContinueToAddress: () => void;
  isCreatingSwap: boolean;
  swapError: string | null;
}

export function EnterAmountStep({
  usdcAmount,
  bitcoinAmount,
  receiveAddress,
  sourceToken,
  targetToken,
  setSourceToken,
  setTargetToken,
  setReceiveAddress,
  handleUsdcChange,
  handleBitcoinChange,
  handleContinueToAddress,
  isCreatingSwap,
  swapError,
}: EnterAmountStepProps) {
  const [addressError, setAddressError] = useState<string | null>(null);
  const [assetPairs, setAssetPairs] = useState<AssetPair[]>([]);
  const [availableSourceTokens, setAvailableSourceTokens] = useState<TokenId[]>(
    [],
  );
  const [availableTargetTokens, setAvailableTargetTokens] = useState<TokenId[]>(
    [],
  );
  const { address, isConnected } = useAccount();

  // Get price feed from context
  const { getExchangeRate, isLoadingPrice, priceError } = usePriceFeed();

  // Fetch asset pairs on mount
  useEffect(() => {
    const fetchAssetPairs = async () => {
      try {
        const pairs = await api.getAssetPairs();
        console.log(`Trading pairs ${JSON.stringify(pairs)}`);
        setAssetPairs(pairs);

        // Extract unique source tokens
        const sources = Array.from(new Set(pairs.map((p) => p.source)));
        setAvailableSourceTokens(sources);
      } catch (error) {
        console.error("Failed to fetch asset pairs:", error);
        // Fallback to default configuration
        const fallbackPairs: AssetPair[] = [
          { source: "btc_lightning", target: "usdc_pol" },
          { source: "btc_lightning", target: "usdt_pol" },
          { source: "usdc_pol", target: "btc_arkade" },
          { source: "usdt_pol", target: "btc_arkade" },
        ];
        setAssetPairs(fallbackPairs);
        setAvailableSourceTokens(["btc_lightning", "usdc_pol", "usdt_pol"]);
      }
    };

    fetchAssetPairs();
  }, []);

  // Update available target tokens when source token changes
  useEffect(() => {
    if (assetPairs.length === 0) return;

    const targets = assetPairs
      .filter((pair) => pair.source === sourceToken)
      .map((pair) => pair.target);

    const uniqueTargets = Array.from(new Set(targets));
    setAvailableTargetTokens(uniqueTargets);

    // If current target is not valid for new source, select first available
    if (uniqueTargets.length > 0 && !uniqueTargets.includes(targetToken)) {
      setTargetToken(uniqueTargets[0]);
    }
  }, [sourceToken, assetPairs, targetToken, setTargetToken]);

  // Clear receive address when target token changes between BTC and non-BTC
  // (Polygon address won't work for BTC and vice versa)
  useEffect(() => {
    const isBtcTarget =
      targetToken === "btc_lightning" || targetToken === "btc_arkade";
    const previousWasBtc =
      receiveAddress &&
      (receiveAddress.toLowerCase().startsWith("lnbc") ||
        receiveAddress.toLowerCase().startsWith("lntb") ||
        receiveAddress.toLowerCase().startsWith("lnbcrt") ||
        receiveAddress.toLowerCase().startsWith("ark1") ||
        receiveAddress.toLowerCase().startsWith("tark1"));
    const previousWasPolygon = receiveAddress?.toLowerCase().startsWith("0x");

    if (
      (isBtcTarget && previousWasPolygon) ||
      (!isBtcTarget && previousWasBtc)
    ) {
      setReceiveAddress("");
      setAddressError(null);
    }
  }, [targetToken, receiveAddress, setReceiveAddress]);

  // Calculate exchange rate based on selected token and USD amount
  const usdAmount = parseFloat(usdcAmount) || 1;
  const exchangeRate = getExchangeRate(targetToken, usdAmount);

  // Get display info for any token
  const getTokenDisplay = (tokenId: TokenId) => {
    switch (tokenId) {
      case "btc_lightning":
        return { symbol: "BTC", network: "Lightning", name: "Bitcoin Lightning", icon: LightningIcon };
      case "btc_arkade":
        return { symbol: "BTC", network: "Arkade", name: "Bitcoin Arkade", icon: BitcoinIcon };
      case "usdc_pol":
        return { symbol: "USDC", network: "Polygon", name: "USD Coin", icon: UsdcIcon };
      case "usdt_pol":
        return { symbol: "USDT0", network: "Polygon", name: "Tether USD", icon: TetherIcon };
      default:
        return { symbol: "USDC", network: "Polygon", name: "USD Coin", icon: UsdcIcon };
    }
  };

  const sourceDisplay = getTokenDisplay(sourceToken);
  const targetDisplay = getTokenDisplay(targetToken);
  const SourceIcon = sourceDisplay.icon;
  const TargetIcon = targetDisplay.icon;

  const onAddressChange = (address: string) => {
    setReceiveAddress(address);

    // Clear error if address is empty (not yet entered)
    if (address === "") {
      setAddressError(null);
      return;
    }

    // Validate based on target token type
    const isBtcTarget =
      targetToken === "btc_lightning" || targetToken === "btc_arkade";

    if (isBtcTarget) {
      // Validate Lightning invoice or Arkade address
      const isLightningInvoice =
        address.toLowerCase().startsWith("lnbc") ||
        address.toLowerCase().startsWith("lntb") ||
        address.toLowerCase().startsWith("lnbcrt");
      const isArkadeAddress =
        address.toLowerCase().startsWith("ark1") ||
        address.toLowerCase().startsWith("tark1");

      if (!isLightningInvoice && !isArkadeAddress) {
        setAddressError(
          "Invalid Bitcoin address. Please enter a Lightning invoice (lnbc...) or Arkade address (ark1...)",
        );
      } else {
        setAddressError(null);
      }
    } else {
      // Validate Polygon address
      if (!isAddress(address)) {
        setAddressError(
          "Invalid Polygon address. Please enter a valid address starting with 0x",
        );
      } else {
        setAddressError(null);
      }
    }
  };

  return (
    <CardContent className="space-y-4 pt-6">
      {/* Source Token Input - You Send */}
      <div className="space-y-2">
        <label
          htmlFor="source-input"
          className="text-muted-foreground text-sm font-medium"
        >
          You Send
        </label>
        <div className="relative">
          <Input
            id="source-input"
            type="number"
            placeholder="0.00"
            value={bitcoinAmount}
            onChange={(e) => handleBitcoinChange(e.target.value)}
            className="h-14 pr-40 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Select value={sourceToken} onValueChange={setSourceToken}>
              <SelectTrigger className="h-14 w-[130px] border-0 bg-orange-500/10 hover:bg-orange-500/20 focus:ring-0 focus:ring-offset-0">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <SourceIcon className="h-6 w-6" />
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-bold leading-tight">
                        {sourceDisplay.symbol}
                      </span>
                      <span className="text-xs text-muted-foreground leading-tight">
                        {sourceDisplay.network}
                      </span>
                    </div>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableSourceTokens.length > 0 ? (
                  availableSourceTokens.map((tokenId) => {
                    const display = getTokenDisplay(tokenId);
                    const Icon = display.icon;
                    return (
                      <SelectItem key={tokenId} value={tokenId}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-6 w-6" />
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{display.symbol}</span>
                            <span className="text-xs text-muted-foreground">{display.network}</span>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem value="btc_lightning" disabled>
                    <span className="text-muted-foreground">Loading...</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {bitcoinAmount && exchangeRate && (
          <p className="text-muted-foreground text-xs">
            ≈ ${(parseFloat(bitcoinAmount) * exchangeRate).toLocaleString()}
          </p>
        )}
      </div>

      {/* Swap Icon */}
      <div className="-my-2 flex justify-center">
        <ArrowDownUp className="text-muted-foreground h-4 w-4 opacity-50" />
      </div>

      {/* Target Token Input - You Receive */}
      <div className="space-y-2">
        <label
          htmlFor="target-input"
          className="text-muted-foreground text-sm font-medium"
        >
          You Receive
        </label>
        <div className="relative">
          <Input
            id="target-input"
            type="number"
            placeholder="0.00"
            value={usdcAmount}
            onChange={(e) => handleUsdcChange(e.target.value)}
            className="h-14 pr-40 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Select value={targetToken} onValueChange={setTargetToken}>
              <SelectTrigger className="h-14 w-[130px] border-0 bg-blue-500/10 hover:bg-blue-500/20 focus:ring-0 focus:ring-offset-0">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <TargetIcon className="h-6 w-6" />
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-bold leading-tight">
                        {targetDisplay.symbol}
                      </span>
                      <span className="text-xs text-muted-foreground leading-tight">
                        {targetDisplay.network}
                      </span>
                    </div>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableTargetTokens.length > 0 ? (
                  availableTargetTokens.map((tokenId) => {
                    const display = getTokenDisplay(tokenId);
                    const Icon = display.icon;
                    return (
                      <SelectItem key={tokenId} value={tokenId}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-6 w-6" />
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{display.symbol}</span>
                            <span className="text-xs text-muted-foreground">{display.network}</span>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem value="usdc_pol" disabled>
                    <span className="text-muted-foreground">Loading...</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {usdcAmount && (
          <p className="text-muted-foreground text-xs">
            ≈ ${parseFloat(usdcAmount).toLocaleString()}
          </p>
        )}
      </div>

      {/* Exchange Info */}
      <div className="bg-muted/50 space-y-2 rounded-lg p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Exchange Rate</span>
          {isLoadingPrice || exchangeRate === undefined ? (
            <Skeleton className="h-5 w-32" />
          ) : (
            <span className="font-medium">
              1 {sourceDisplay.symbol} ≈{" "}
              {exchangeRate?.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}{" "}
              {targetDisplay.symbol}
            </span>
          )}
        </div>
      </div>

      {/* Price Error Display */}
      {priceError && (
        <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-lg border p-3 text-sm">
          <p className="font-medium">Failed to fetch price</p>
          <p className="mt-1 text-xs">{priceError}</p>
        </div>
      )}

      {/* Address Input */}
      <div className="space-y-2">
        <label
          htmlFor="receive-address-input"
          className="text-muted-foreground text-sm font-medium"
        >
          {targetToken === "btc_lightning" || targetToken === "btc_arkade"
            ? `Bitcoin Address (Lightning invoice or Arkade address for ${targetDisplay.symbol})`
            : `Polygon Address (where you want to receive ${targetDisplay.symbol})`}
        </label>
        <div className="relative flex w-full items-center gap-2">
          <Input
            id="receive-address-input"
            type="text"
            placeholder={
              targetToken === "btc_lightning" || targetToken === "btc_arkade"
                ? "lnbc... or ark1..."
                : "0x..."
            }
            value={receiveAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            className="h-12 pr-36 font-mono text-sm"
            data-1p-ignore
            data-lpignore="true"
            autoComplete="off"
          />

          {/* Get Address Button - Only for Polygon addresses */}
          <div className="absolute right-2">
            {targetToken !== "btc_lightning" &&
              targetToken !== "btc_arkade" && (
                <>
                  {isConnected && !receiveAddress ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        if (address) {
                          onAddressChange(address);
                        }
                      }}
                      type="button"
                    >
                      Get Address
                    </Button>
                  ) : !isConnected ? (
                    <ConnectKitButton.Custom>
                      {({ show }) => (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={show}
                          type="button"
                        >
                          Connect Wallet
                        </Button>
                      )}
                    </ConnectKitButton.Custom>
                  ) : null}
                </>
              )}
          </div>
        </div>

        {/* Address Error Display */}
        {addressError && (
          <p className="text-destructive text-xs mt-1">{addressError}</p>
        )}
      </div>

      {/* Swap Error Display */}
      {swapError && (
        <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-lg border p-3 text-sm">
          {swapError}
        </div>
      )}

      {/* Continue Button */}
      <Button
        className="h-12 w-full text-base font-semibold"
        onClick={handleContinueToAddress}
        disabled={
          !bitcoinAmount ||
          !usdcAmount ||
          !receiveAddress ||
          !!addressError ||
          isCreatingSwap
        }
      >
        {isCreatingSwap ? "Creating Swap..." : "Continue"}
      </Button>
    </CardContent>
  );
}
