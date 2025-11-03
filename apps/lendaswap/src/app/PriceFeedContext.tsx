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

  // Helper function to get exchange rate for a specific token pair and USD amount
  // Returns the exchange rate as: 1 sourceToken = X targetToken
  const getExchangeRate = (
    sourceToken: TokenId,
    targetToken: TokenId,
    usdAmount: number,
  ): number | null => {
    if (!priceUpdate) return null;

    const isBtcSource =
      sourceToken === "btc_lightning" || sourceToken === "btc_arkade";
    const isBtcTarget =
      targetToken === "btc_lightning" || targetToken === "btc_arkade";
    const isUsdSource =
      sourceToken === "usdc_pol" || sourceToken === "usdt_pol";
    const isUsdTarget =
      targetToken === "usdc_pol" || targetToken === "usdt_pol";

    // Determine which token pair to use
    let pairName: string;

    if (isBtcSource && isUsdTarget) {
      // BTC -> USD swap: use USDC_POL-BTC or USDT_POL-BTC pair
      if (targetToken === "usdc_pol") {
        pairName = "USDC_POL-BTC";
      } else {
        pairName = "USDT_POL-BTC";
      }
      // Rate is already in USD per BTC, which is what we want
    } else if (isUsdSource && isBtcTarget) {
      // USD -> BTC swap: use BTC-USDC_POL or BTC-USDT_POL pair
      if (sourceToken === "usdc_pol") {
        pairName = "BTC-USDC_POL";
      } else {
        pairName = "BTC-USDT_POL";
      }
    } else {
      // Unsupported pair (e.g., BTC->BTC or USD->USD)
      console.warn(`Unsupported token pair: ${sourceToken} -> ${targetToken}`);
      return null;
    }

    const pair = priceUpdate.pairs.find((p) => p.pair === pairName);
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
