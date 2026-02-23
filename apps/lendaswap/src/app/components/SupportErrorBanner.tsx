import { AlertCircle, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { api } from "../api";

const SUPPORT_EMAIL = "support@lendasat.com";

/** Error messages the user can resolve themselves — no support needed. */
const KNOWN_ERROR_PATTERNS: Array<{ pattern: RegExp; action: string }> = [
  {
    pattern: /please enter a.*address/i,
    action: "Please enter a valid address above.",
  },
  {
    pattern: /please enter a valid/i,
    action: "Please check the address format and try again.",
  },
  {
    pattern: /locktime has not been reached/i,
    action:
      "The refund locktime hasn't passed yet. Please wait and try again later.",
  },
  {
    pattern: /payment details not available/i,
    action:
      "Payment details are still loading. Please wait a moment and try again.",
  },
  {
    pattern: /please refresh and try again/i,
    action: "Please refresh the page and try again.",
  },
];

function getKnownAction(error: string): string | null {
  for (const { pattern, action } of KNOWN_ERROR_PATTERNS) {
    if (pattern.test(error)) return action;
  }
  return null;
}

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
  const knownAction = getKnownAction(error);

  useEffect(() => {
    if (!knownAction) {
      api
        .getUserIdXpub()
        .then(setXpub)
        .catch(() => {});
    }
  }, [knownAction]);

  // Known/actionable error — show instruction, no support button
  if (knownAction) {
    return (
      <div className="rounded-xl border border-orange-500/30 bg-orange-50 p-3 flex items-center gap-3 dark:bg-orange-950/20">
        <AlertCircle className="h-4 w-4 shrink-0 text-orange-600" />
        <span className="text-sm text-orange-600">{knownAction}</span>
      </div>
    );
  }

  // Unknown error — show support button
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
