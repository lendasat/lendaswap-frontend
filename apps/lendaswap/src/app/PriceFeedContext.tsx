import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { type PriceUpdateMessage, priceFeedService, type TokenId } from "./api";

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
  // For BTC->USD swaps: returns USD per BTC (e.g., 95000 USDC per 1 BTC)
  // For USD->BTC swaps: returns BTC per USD (e.g., 0.00001053 BTC per 1 USDC)
  const getExchangeRate = (
    token: TokenId,
    usdAmount: number,
  ): number | null => {
    if (!priceUpdate) return null;

    // Determine which token pair to use based on target token
    let pairName: string;
    let needsInversion = false;

    if (token === "btc_lightning" || token === "btc_arkade") {
      // USD -> BTC swap: use BTC-USDC_POL pair (already in correct direction)
      pairName = "BTC-USDC_POL";
      needsInversion = true; // Backend sends USD per BTC, we need BTC per USD
    } else if (token === "usdc_pol") {
      // BTC -> USDC swap: use USDC_POL-BTC pair
      pairName = "USDC_POL-BTC";
    } else {
      // BTC -> USDT swap: use USDT_POL-BTC pair
      pairName = "USDT_POL-BTC";
    }

    const pair = priceUpdate.pairs.find((p) => p.pair === pairName);
    if (!pair) return null;

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

    // If target is BTC, we need the inverse rate (BTC per USD)
    // The rate from backend is USD per BTC, so we invert it
    if (needsInversion) {
      return 1 / rate;
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
