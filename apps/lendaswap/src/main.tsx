import {StrictMode} from "react";
import * as ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router";
import "@radix-ui/themes/styles.css";
import {Theme} from "@radix-ui/themes";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {getDefaultConfig, RainbowKitProvider} from "@rainbow-me/rainbowkit";
import {WagmiProvider} from "wagmi";
import {polygon} from "viem/chains";
import {WalletBridgeProvider} from "./app/WalletBridgeContext";
import App from "./app/App";
import {ThemeProvider} from "./app/utils/theme-provider";

const config = getDefaultConfig({
    appName: "LendaSwap",
    projectId: "a15c535db177c184c98bdbdc5ff12590",
    chains: [polygon],
    ssr: false,
});

const queryClient = new QueryClient();

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
    <StrictMode>
        <BrowserRouter>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <RainbowKitProvider>
                        <Theme>
                            <ThemeProvider>
                                <WalletBridgeProvider>
                                    <App/>
                                </WalletBridgeProvider>
                            </ThemeProvider>
                        </Theme>
                    </RainbowKitProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </BrowserRouter>
    </StrictMode>,
);
