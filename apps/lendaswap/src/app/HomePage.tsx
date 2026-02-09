import {
  BTC_ARKADE,
  isArkade,
  isBtc,
  isBtcOnchain,
  isEthereumToken,
  isEvmToken,
  type TokenId,
} from "@lendasat/lendaswap-sdk-pure";
import { ConnectKitButton } from "connectkit";
import { ArrowDown, Loader, Wallet } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { isValidSpeedWalletContext } from "../utils/speedWallet";
import { getTokenSymbol } from "./api";
import { AddressInput } from "./components/AddressInput";
import { AmountInput } from "./components/AmountInput";
import { AssetDropDown } from "./components/AssetDropDown";
import { useCreateSwap } from "./hooks/useCreateSwap";
import { useSwapForm } from "./hooks/useSwapForm";

export function HomePage() {
  const {
    sourceAsset,
    setSourceAsset,
    targetAsset,
    setTargetAsset,
    sourceAssetAmount,
    setSourceAssetAmount,
    targetAssetAmount,
    setTargetAssetAmount,
    lastFieldEdited,
    setLastFieldEdited,
    targetAddress,
    setTargetAddress,
    addressValid,
    setAddressValid,
    userEvmAddress,
    isEvmAddressValid,
    quote,
    isLoadingQuote,
    isLoadingPrice,
    expectedChain,
    isWrongChain,
    isConnected,
    isInitialLoading,
    tokens,
    availableSourceAssets,
    availableTargetAssets,
    isEmbedded,
    arkAddress,
    getUsdPerToken,
    navigate,
  } = useSwapForm();

  const { createSwap, isCreatingSwap, swapError } = useCreateSwap({
    sourceAsset,
    targetAsset,
    sourceAssetAmount,
    targetAssetAmount,
    targetAddress,
    userEvmAddress,
    isEvmAddressValid,
    lastFieldEdited,
  });

  const handleContinueToFund = async () => {
    if (!targetAddress || !sourceAssetAmount || !addressValid) {
      return;
    }

    await createSwap();
  };

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
        <div className="rounded-2xl bg-muted p-4 pb-5 overflow-hidden">
          <div className="text-sm text-muted-foreground mb-2">Sell</div>
          <div className="flex items-start justify-between gap-4">
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
            <div className="shrink-0 pt-1">
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
                    navigate(`/${asset}/${newTarget}`, {
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
                    navigate(`/${asset}/${targetAsset}`, { replace: true });
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
                    setTargetAsset("usdc_pol" as TokenId);
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
          data-no-press
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
        <div className="rounded-2xl bg-muted p-4 pt-5 mt-1 overflow-hidden">
          <div className="text-sm text-muted-foreground mb-2">Buy</div>
          <div className="flex items-start justify-between gap-4">
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
            <div className="shrink-0 pt-1">
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
                    setSourceAsset("usdc_pol" as TokenId);
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
