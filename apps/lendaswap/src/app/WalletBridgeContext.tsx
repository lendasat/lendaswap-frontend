import { AddressType, LendasatClient } from "@lendasat/lendasat-wallet-bridge";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

interface WalletBridgeContextType {
  client: LendasatClient | null;
  arkAddress: string | null;
  isEmbedded: boolean;
  isReady: boolean;
}

const WalletBridgeContext = createContext<WalletBridgeContextType>({
  client: null,
  arkAddress: null,
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
  const [arkAddress, setArkAddress] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're running in an iframe
    const embedded = window.self !== window.top;
    setIsEmbedded(embedded);

    if (embedded) {
      // Initialize the wallet bridge client
      const bridgeClient = new LendasatClient();
      setClient(bridgeClient);

      // Async initialization
      (async () => {
        try {
          const address = await bridgeClient.getAddress(AddressType.ARK);
          setArkAddress(address);
        } catch (error) {
          console.error("Failed to get Ark address:", error);
        } finally {
          setIsReady(true);
        }
      })();

      // Cleanup on unmount
      return () => {
        bridgeClient.destroy();
      };
    } else {
      setIsReady(true);
    }
  }, []);

  return (
    <WalletBridgeContext.Provider
      value={{ client, isEmbedded, isReady, arkAddress }}
    >
      {children}
    </WalletBridgeContext.Provider>
  );
}
