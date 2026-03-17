import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { arbitrum, mainnet, polygon } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { http } from "viem";
import { WagmiProvider } from "wagmi";
import App from "./app/App";
import { NwcProvider } from "./app/NwcContext";
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
const networks = [mainnet, polygon, arbitrum];
const projectId = "a15c535db177c184c98bdbdc5ff12590";
const rpcOverrideChainId = import.meta.env.VITE_RPC_OVERRIDE_CHAIN_ID;
const rpcOverrideUrl = import.meta.env.VITE_RPC_OVERRIDE_URL;

const transports: Record<number, ReturnType<typeof http>> = {};
if (rpcOverrideChainId && rpcOverrideUrl) {
  transports[Number(rpcOverrideChainId)] = http(rpcOverrideUrl);
}

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: [networks[0], ...networks.slice(1)],
  projectId,
  metadata: {
    name: "LendaSwap",
    description: "Lightning-Fast Bitcoin Atomic Swaps",
    url: window.location.origin,
    icons: [],
  },
});

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
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <Theme>
              <ThemeProvider>
                <WalletBridgeProvider>
                  <NwcProvider>
                    <App />
                  </NwcProvider>
                </WalletBridgeProvider>
              </ThemeProvider>
            </Theme>
          </QueryClientProvider>
        </WagmiProvider>
      </BrowserRouter>
    </Analytics>
  </StrictMode>,
);
