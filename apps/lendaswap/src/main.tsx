import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@radix-ui/themes/styles.css";
import {
  generateOrGetMnemonic,
  initBrowserWallet,
} from "@frontend/browser-wallet";
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { PostHogProvider } from "posthog-js/react";
import { polygon } from "viem/chains";
import { createConfig, WagmiProvider } from "wagmi";
import App from "./app/App";
import { PriceFeedProvider } from "./app/PriceFeedContext";
import { ThemeProvider } from "./app/utils/theme-provider";
import { WalletBridgeProvider } from "./app/WalletBridgeContext";
import { PostHogSuperProperties } from "./components/PostHogSuperProperties";
import { createPostHogConfig } from "./config/posthogConfig";

const config = createConfig(
  getDefaultConfig({
    appName: "LendaSwap",
    walletConnectProjectId: "a15c535db177c184c98bdbdc5ff12590",
    chains: [polygon],
  }),
);

const queryClient = new QueryClient();

// PostHog configuration
const posthogKey =
  import.meta.env.VITE_POSTHOG_API_KEY ||
  "phc_3MrZhmMPhgvjtBN54e9aDhV2iVAom8t3ocDizQxofyw";
const posthogHost =
  import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";
const posthogOptions = createPostHogConfig(posthogHost);

// @ts-expect-error
const root = ReactDOM.createRoot(document.getElementById("root"));

// Initialize browser wallet WASM before rendering
(async () => {
  try {
    await initBrowserWallet();
    // Generate or retrieve mnemonic to ensure wallet is ready
    await generateOrGetMnemonic();
  } catch (error) {
    console.error("Failed to initialize browser wallet:", error);
  }

  root.render(
    <StrictMode>
      <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
        <PostHogSuperProperties />
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
      </PostHogProvider>
    </StrictMode>,
  );
})();
