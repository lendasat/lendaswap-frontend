import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { api } from "../api";

const SUPPORT_EMAIL = "support@lendasat.com";

interface SupportErrorBannerProps {
  /** Short user-facing message (e.g. "Failed to create swap"). */
  message?: string;
  /** Raw error string — included in the support email, NOT shown to the user. */
  error: string;
  /** Swap ID, if available — included in the support email. */
  swapId?: string;
}

function buildMailtoUrl(error: string, swapId?: string, xpub?: string): string {
  const subject = swapId
    ? `LendaSwap Support — Swap ${swapId}`
    : "LendaSwap Support Request";

  const body = [
    swapId && `Swap ID: ${swapId}`,
    xpub && `User xpub: ${xpub}`,
    `Error: ${error}`,
    "",
    "Please describe what happened:",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SupportErrorBanner({
  message = "Something went wrong",
  error,
  swapId,
}: SupportErrorBannerProps) {
  const [xpub, setXpub] = useState<string>();

  useEffect(() => {
    api.getUserIdXpub().then(setXpub).catch(() => {});
  }, []);

  return (
    <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl border p-3 flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{message}</span>
      <a href={buildMailtoUrl(error, swapId, xpub)} className="shrink-0">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Mail className="h-3.5 w-3.5" />
          Get Support
        </Button>
      </a>
    </div>
  );
}
