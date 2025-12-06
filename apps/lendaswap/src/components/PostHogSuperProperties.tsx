import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { api } from "../app/api";
import { isValidSpeedWalletContext } from "../utils/speedWallet";

export function PostHogSuperProperties() {
  const posthog = usePostHog();

  useEffect(() => {
    const setupPostHog = async () => {
      if (!posthog) return;

      // Detect if running in iframe (Arkade wallet embed)
      const isEmbedded = window.self !== window.top;
      const isSpeedWallet = isValidSpeedWalletContext();

      // Determine source based on context
      let source = "direct";
      if (isEmbedded) {
        source = "arkade_wallet";
      } else if (isSpeedWallet) {
        source = "speed_wallet";
      }

      // Check for UTM source in URL (takes precedence if present)
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get("utm_source");
      if (utmSource) {
        source = utmSource;
      }

      // Set super properties so they're included in all events
      posthog.register({
        app_type: "swap",
        is_embedded: isEmbedded,
        is_speed_wallet: isSpeedWallet,
        source: source,
      });

      // Identify user by their xpub (same as used for swap recovery)
      // This enables retention tracking across browser sessions and devices
      try {
        const xpub = await api.getUserIdXpub();
        if (xpub) {
          posthog.identify(xpub, {
            wallet_type: "browser_wallet",
          });
        }
      } catch (error) {
        console.error("Failed to identify user with xpub:", error);
      }
    };

    setupPostHog();
  }, [posthog]);

  return null;
}
