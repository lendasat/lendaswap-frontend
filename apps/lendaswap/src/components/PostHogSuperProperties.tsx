import { getUserIdXpub } from "@frontend/browser-wallet";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogSuperProperties() {
  const posthog = usePostHog();

  useEffect(() => {
    const setupPostHog = async () => {
      if (!posthog) return;

      // Set app_type as a super property so it's included in all events
      posthog.register({ app_type: "swap" });

      // Identify user by their xpub (same as used for swap recovery)
      // This enables retention tracking across browser sessions and devices
      try {
        const xpub = await getUserIdXpub();
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
