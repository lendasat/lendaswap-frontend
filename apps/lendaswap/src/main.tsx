import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { createConfig, WagmiProvider } from "wagmi";
import { polygon } from "viem/chains";
import { WalletBridgeProvider } from "./app/WalletBridgeContext";
import App from "./app/App";
import { ThemeProvider } from "./app/utils/theme-provider";
import { PriceFeedProvider } from "./app/PriceFeedContext";

const config = createConfig(
  getDefaultConfig({
    appName: "LendaSwap",
    walletConnectProjectId: "a15c535db177c184c98bdbdc5ff12590",
    chains: [polygon],
  }),
);

const queryClient = new QueryClient();

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <BrowserRouter>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider mode="auto">
            <Theme>
              <ThemeProvider>
                <PriceFeedProvider>
                  <WalletBridgeProvider>
                    <App />
                  </WalletBridgeProvider>
                </PriceFeedProvider>
              </ThemeProvider>
            </Theme>
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </BrowserRouter>
  </StrictMode>,
);
