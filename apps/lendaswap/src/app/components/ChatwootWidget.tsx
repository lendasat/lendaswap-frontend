import { useEffect } from "react";

const BASE_URL = "https://app.chatwoot.com";
const TOKEN = import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN;

export function ChatwootWidget() {
  useEffect(() => {
    if (!TOKEN || window.$chatwoot) return;

    const script = document.createElement("script");
    script.src = `${BASE_URL}/packs/js/sdk.js`;
    script.async = true;
    script.onload = () => {
      window.chatwootSDK?.run({ websiteToken: TOKEN, baseUrl: BASE_URL });
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}
