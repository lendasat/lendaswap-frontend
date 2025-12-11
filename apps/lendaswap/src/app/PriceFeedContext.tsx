import { PriceFeedService, type PriceUpdateMessage } from "@lendaswap/sdk";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { TokenId } from "./api";
import { toPairName } from "./utils/tokenUtils";

// Get API URL from environment
const API_BASE_URL =
  import.meta.env.VITE_LENDASWAP_API_URL || "http://localhost:3333";

interface PriceFeedContextValue {
  // Latest price update from WebSocket
  priceUpdate: PriceUpdateMessage | null;
  // Loading state (true until first price received)
  isLoadingPrice: boolean;
  // Error state
  priceError: string | null;
  // Helper to get exchange rate for a specific token and amount (in quote asset units)
  getExchangeRate: (
    sourceToken: TokenId,
    targetToken: TokenId,
    assetAmount: number,
  ) => number | null;
  // Helper to get BTC price in USD (always returns USD/BTC rate from stablecoin pair)
  getBtcUsdRate: (assetAmount: number) => number | null;
}

const PriceFeedContext = createContext<PriceFeedContextValue | undefined>(
  undefined,
);

interface PriceFeedProviderProps {
  children: ReactNode;
}

export function PriceFeedProvider({ children }: PriceFeedProviderProps) {
  const [priceUpdate, setPriceUpdate] = useState<PriceUpdateMessage | null>(
    null,
  );
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);

  // Create PriceFeedService instance once
  const priceFeedService = useMemo(
    () => new PriceFeedService(API_BASE_URL),
    [],
  );

  useEffect(() => {
    const handlePriceUpdate = (update: PriceUpdateMessage) => {
      try {
        setPriceUpdate(update);
        setIsLoadingPrice(false);
        setPriceError(null);
      } catch (error) {
        console.error("Failed to process price update:", error);
        setPriceError(
          error instanceof Error ? error.message : "Failed to process price",
        );
      }
    };

    // Subscribe to price feed
    const unsubscribe = priceFeedService.subscribe(handlePriceUpdate);

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [priceFeedService]);

  // Helper function to get exchange rate for a specific token pair and asset amount
  // Returns the exchange rate as: 1 sourceToken = X targetToken
  const getExchangeRate = (
    sourceToken: TokenId,
    targetToken: TokenId,
    assetAmount: number,
  ): number | null => {
    if (!priceUpdate) return null;

    // Determine which token pair to use
    const pairName = toPairName(sourceToken, targetToken);

    const pair = priceUpdate.pairs.find(
      (p) => p.pair.toLowerCase() === pairName,
    );
    if (!pair) {
      console.warn(`Price pair not found: ${pairName}`);
      return null;
    }

    // Select tier based on quote asset amount
    let rate: number;
    if (assetAmount >= 5000) {
      rate = pair.tiers.tier_5000;
    } else if (assetAmount >= 1000) {
      rate = pair.tiers.tier_1000;
    } else if (assetAmount >= 100) {
      rate = pair.tiers.tier_100;
    } else {
      rate = pair.tiers.tier_1;
    }

    return rate;
  };

  // FIXME: this is ugly as f**k
  // Helper to get BTC price in USD (from a stablecoin pair)
  // This is needed for displaying USD equivalents when dealing with non-USD tokens like XAUT
  const getBtcUsdRate = (assetAmount: number): number | null => {
    if (!priceUpdate) return null;

    // Try to get rate from USDC_ETH-BTC first (most liquid), fallback to others
    const stablecoinPairs = [
      "usdc_eth-btc",
      "usdc_pol-btc",
      "usdt_eth-btc",
      "usdt0_pol-btc",
    ];

    for (const pairName of stablecoinPairs) {
      const pair = priceUpdate.pairs.find(
        (p) => p.pair.toLowerCase() === pairName,
      );
      if (pair) {
        // Select tier based on asset amount
        let rate: number;
        if (assetAmount >= 5000) {
          rate = pair.tiers.tier_5000;
        } else if (assetAmount >= 1000) {
          rate = pair.tiers.tier_1000;
        } else if (assetAmount >= 100) {
          rate = pair.tiers.tier_100;
        } else {
          rate = pair.tiers.tier_1;
        }
        return rate;
      }
    }

    console.warn("No stablecoin pair found for BTC/USD rate");
    return null;
  };

  const value: PriceFeedContextValue = {
    priceUpdate,
    isLoadingPrice,
    priceError,
    getExchangeRate,
    getBtcUsdRate,
  };

  return (
    <PriceFeedContext.Provider value={value}>
      {children}
    </PriceFeedContext.Provider>
  );
}

// Custom hook to use the price feed context
export function usePriceFeed() {
  const context = useContext(PriceFeedContext);
  if (context === undefined) {
    throw new Error("usePriceFeed must be used within a PriceFeedProvider");
  }
  return context;
}
