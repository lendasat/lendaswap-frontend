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
  // Helper to get exchange rate for a specific token and amount
  getExchangeRate: (
    sourceToken: TokenId,
    targetToken: TokenId,
    usdAmount: number,
  ) => number | null;
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

  // Helper function to get exchange rate for a specific token pair and USD amount
  // Returns the exchange rate as: 1 sourceToken = X targetToken
  const getExchangeRate = (
    sourceToken: TokenId,
    targetToken: TokenId,
    usdAmount: number,
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

    // Select tier based on USD amount
    let rate: number;
    if (usdAmount >= 5000) {
      rate = pair.tiers.usd_5000;
    } else if (usdAmount >= 1000) {
      rate = pair.tiers.usd_1000;
    } else if (usdAmount >= 100) {
      rate = pair.tiers.usd_100;
    } else {
      rate = pair.tiers.usd_1;
    }

    return rate;
  };

  const value: PriceFeedContextValue = {
    priceUpdate,
    isLoadingPrice,
    priceError,
    getExchangeRate,
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
