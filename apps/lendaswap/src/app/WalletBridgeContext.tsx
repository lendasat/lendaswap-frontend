import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { LendasatClient } from "@lendasat/lendasat-wallet-bridge";

interface WalletBridgeContextType {
  client: LendasatClient | null;
  isEmbedded: boolean;
  isReady: boolean;
}

const WalletBridgeContext = createContext<WalletBridgeContextType>({
  client: null,
  isEmbedded: false,
  isReady: false,
});

export const useWalletBridge = () => useContext(WalletBridgeContext);

interface WalletBridgeProviderProps {
  children: ReactNode;
}

export function WalletBridgeProvider({ children }: WalletBridgeProviderProps) {
  const [client, setClient] = useState<LendasatClient | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if we're running in an iframe
    const embedded = window.self !== window.top;
    setIsEmbedded(embedded);

    if (embedded) {
      // Initialize the wallet bridge client
      const bridgeClient = new LendasatClient();
      setClient(bridgeClient);
      setIsReady(true);

      // Cleanup on unmount
      return () => {
        bridgeClient.destroy();
      };
    } else {
      setIsReady(true);
    }
  }, []);

  return (
    <WalletBridgeContext.Provider value={{ client, isEmbedded, isReady }}>
      {children}
    </WalletBridgeContext.Provider>
  );
}
