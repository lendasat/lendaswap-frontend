import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { priceFeedService, type PriceUpdateMessage, type TokenId } from "./api";

interface PriceFeedContextValue {
  // Latest price update from WebSocket
  priceUpdate: PriceUpdateMessage | null;
  // Loading state (true until first price received)
  isLoadingPrice: boolean;
  // Error state
  priceError: string | null;
  // Helper to get exchange rate for a specific token and amount
  getExchangeRate: (token: TokenId, usdAmount: number) => number | null;
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
  }, []);

  // Helper function to get exchange rate for a specific token and USD amount
  const getExchangeRate = (
    token: TokenId,
    usdAmount: number,
  ): number | null => {
    if (!priceUpdate) return null;

    // Find the appropriate trading pair based on token
    const pairName = token === "usdc_pol" ? "USDC_POL-BTC" : "USDT_POL-BTC";
    const pair = priceUpdate.pairs.find((p) => p.pair === pairName);

    if (!pair) return null;

    // Select tier based on USD amount
    if (usdAmount >= 5000) {
      return pair.tiers.usd_5000;
    } else if (usdAmount >= 1000) {
      return pair.tiers.usd_1000;
    } else if (usdAmount >= 100) {
      return pair.tiers.usd_100;
    } else {
      return pair.tiers.usd_1;
    }
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
