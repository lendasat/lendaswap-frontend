import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { PostHogProvider } from "posthog-js/react";
import { http } from "viem";
import { arbitrum, mainnet, polygon } from "viem/chains";
import { createConfig, WagmiProvider } from "wagmi";
import App from "./app/App";
import { ThemeProvider } from "./app/utils/theme-provider";
import { WalletBridgeProvider } from "./app/WalletBridgeContext";
import { PostHogSuperProperties } from "./components/PostHogSuperProperties";
import { createPostHogConfig } from "./config/posthogConfig";
import { getSpeedWalletParams } from "./utils/speedWallet";

// Capture Speed Wallet params IMMEDIATELY before any routing/redirects happen.
// This persists them to sessionStorage so they survive React Router redirects.
getSpeedWalletParams();

// Allow overriding the RPC URL for a specific chain via env variable.
// e.g. VITE_RPC_OVERRIDE_CHAIN_ID=137 VITE_RPC_OVERRIDE_URL=http://localhost:8545
const chains = [mainnet, polygon, arbitrum] as const;
const rpcOverrideChainId = import.meta.env.VITE_RPC_OVERRIDE_CHAIN_ID;
const rpcOverrideUrl = import.meta.env.VITE_RPC_OVERRIDE_URL;

const defaultCfg = getDefaultConfig({
  appName: "LendaSwap",
  appUrl: window.location.origin,
  walletConnectProjectId: "a15c535db177c184c98bdbdc5ff12590",
  chains,
});

if (rpcOverrideChainId && rpcOverrideUrl) {
  const overrideId = Number(rpcOverrideChainId);
  const original = defaultCfg.transports as Record<
    number,
    ReturnType<typeof http>
  >;
  original[overrideId] = http(rpcOverrideUrl);
}

const config = createConfig(defaultCfg);

const queryClient = new QueryClient();

// PostHog configuration – disable via VITE_POSTHOG_DISABLED=true or
// localStorage.setItem("posthog_disabled", "true") in the browser console.
const posthogDisabled =
  import.meta.env.VITE_POSTHOG_DISABLED === "true" ||
  localStorage.getItem("posthog_disabled") === "true";
const posthogKey =
  import.meta.env.VITE_POSTHOG_API_KEY ||
  "phc_3MrZhmMPhgvjtBN54e9aDhV2iVAom8t3ocDizQxofyw";
const posthogHost =
  import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";
const posthogOptions = createPostHogConfig(posthogHost);

// @ts-expect-error
const root = ReactDOM.createRoot(document.getElementById("root"));

// Initialize browser wallet WASM before rendering
const Analytics = posthogDisabled
  ? ({ children }: { children: React.ReactNode }) => <>{children}</>
  : ({ children }: { children: React.ReactNode }) => (
      <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
        <PostHogSuperProperties />
        {children}
      </PostHogProvider>
    );

root.render(
  <StrictMode>
    <Analytics>
      <BrowserRouter>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <ConnectKitProvider
              mode="auto"
              options={{
                hideQuestionMarkCTA: true,
                hideNoWalletCTA: false,
                walletConnectCTA: "link",
              }}
            >
              <Theme>
                <ThemeProvider>
                  <WalletBridgeProvider>
                    <App />
                  </WalletBridgeProvider>
                </ThemeProvider>
              </Theme>
            </ConnectKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </BrowserRouter>
    </Analytics>
  </StrictMode>,
);
