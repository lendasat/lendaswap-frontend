import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

export function PostHogSuperProperties() {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog) {
      // Set app_type as a super property so it's included in all events
      posthog.register({ app_type: "swap" });

      // Also set as a person property so it's on the user profile
      posthog.setPersonProperties({ app_type: "swap" });
    }
  }, [posthog]);

  return null;
}
