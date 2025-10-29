import { useState } from "react";
import { ArrowDownUp, Bitcoin, CircleDollarSign } from "lucide-react";
import { Button } from "#/components/ui/button";
import { CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isAddress } from "ethers";

interface EnterAmountStepProps {
  usdcAmount: string;
  bitcoinAmount: string;
  exchangeRate: number | null | undefined;
  isLoadingPrice: boolean;
  priceError: string | null;
  receiveAddress: string;
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
  exchangeRate,
  isLoadingPrice,
  priceError,
  receiveAddress,
  setReceiveAddress,
  handleUsdcChange,
  handleBitcoinChange,
  handleContinueToAddress,
  isCreatingSwap,
  swapError,
}: EnterAmountStepProps) {
  const [addressError, setAddressError] = useState<string | null>(null);

  const onAddressChange = (address: string) => {
    setReceiveAddress(address);

    // Clear error if address is empty (not yet entered)
    if (address === "") {
      setAddressError(null);
      return;
    }

    // Validate address format
    if (!isAddress(address)) {
      setAddressError(
        "Invalid Polygon address. Please enter a valid address starting with 0x",
      );
    } else {
      setAddressError(null);
    }
  };

  return (
    <CardContent className="space-y-4 pt-6">
      {/* USDC Input */}
      <div className="space-y-2">
        <label
          htmlFor="usdc-input"
          className="text-muted-foreground text-sm font-medium"
        >
          How much do you want to receive? (USDC, Polygon)
        </label>
        <div className="relative">
          <Input
            id="usdc-input"
            type="number"
            placeholder="0.00"
            value={usdcAmount}
            onChange={(e) => handleUsdcChange(e.target.value)}
            className="h-14 pr-32 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-1.5">
              <CircleDollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold">USDC</span>
            </div>
          </div>
        </div>
        {usdcAmount && (
          <p className="text-muted-foreground text-xs">
            ≈ ${parseFloat(usdcAmount).toLocaleString()}
          </p>
        )}
      </div>

      {/* Swap Icon */}
      <div className="-my-2 flex justify-center">
        <ArrowDownUp className="text-muted-foreground h-4 w-4 opacity-50" />
      </div>

      {/* Bitcoin Output */}
      <div className="space-y-2">
        <label
          htmlFor="bitcoin-input"
          className="text-muted-foreground text-sm font-medium"
        >
          You Send
        </label>
        <div className="relative">
          <Input
            id="bitcoin-input"
            type="number"
            placeholder="0.00"
            value={bitcoinAmount}
            onChange={(e) => handleBitcoinChange(e.target.value)}
            className="h-14 pr-32 text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 px-3 py-1.5">
              <Bitcoin className="h-5 w-5 text-orange-500 dark:text-orange-400" />
              <span className="text-sm font-semibold">BTC</span>
            </div>
          </div>
        </div>
        {bitcoinAmount && exchangeRate && (
          <p className="text-muted-foreground text-xs">
            ≈ ${(parseFloat(bitcoinAmount) * exchangeRate).toLocaleString()}
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
              1 BTC ≈{" "}
              {exchangeRate?.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}{" "}
              USDC
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
          htmlFor="polygon-address-input"
          className="text-muted-foreground text-sm font-medium"
        >
          Polygon Address (where you want to receive USDC)
        </label>
        <div className="relative flex w-full items-center gap-2">
          <Input
            id="polygon-address-input"
            type="text"
            placeholder="0x..."
            value={receiveAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            className="h-12 pr-36 font-mono text-sm"
          />

          {/* Get Address Button */}
          <div className="absolute right-2">
            <ConnectButton.Custom>
              {({
                account,
                chain,
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
                            variant="default"
                            size="sm"
                            onClick={openConnectModal}
                            type="button"
                          >
                            Connect Wallet
                          </Button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={openChainModal}
                            type="button"
                          >
                            Wrong network
                          </Button>
                        );
                      }

                      return (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            if (account.address) {
                              onAddressChange(account.address);
                            }
                          }}
                          type="button"
                        >
                          Get Address
                        </Button>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
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
