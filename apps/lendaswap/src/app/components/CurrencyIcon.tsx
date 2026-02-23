import { Bitcoin, DollarSign } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// ── Custom SVG icons ─────────────────────────────────────────────────

/** Gold bar icon – stroke-based SVG matching the Lucide icon style. */
function GoldBar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 6h8l3 12H5z" />
      <path d="M10 6l1 5" />
    </svg>
  );
}

/**
 * Satoshi symbol – three parallel diagonal lines with two short vertical strokes.
 * Coordinates taken from the Bitcoin Design community Biticon set (MIT).
 * @see https://bitcoin.design/guide/designing-products/units-and-symbols/
 */
function SatoshiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      {...props}
    >
      {/* Three parallel diagonal lines — official Bitcoin Design coordinates */}
      <path d="M8.86 8.01L16.5 10.07" />
      <path d="M8.18 10.97L15.82 13.04" />
      <path d="M7.5 13.92L15.14 15.99" />
      {/* Short vertical strokes above / below the outer lines */}
      <path d="M13.09 7.27L13.5 5.5" />
      <path d="M10.5 18.5L10.91 16.73" />
    </svg>
  );
}

// ── Icon mapping ─────────────────────────────────────────────────────
// Maps token symbols → category → icon component. Add new tokens in
// SYMBOL_CATEGORY; add new categories in CATEGORY_ICON.

type CurrencyCategory = "stablecoin" | "bitcoin" | "sats" | "gold";
type IconComponent = ComponentType<{ className?: string }>;

const SYMBOL_CATEGORY: Record<string, CurrencyCategory> = {
  usdc: "stablecoin",
  usdt: "stablecoin",
  usdt0: "stablecoin",
  dai: "stablecoin",
  busd: "stablecoin",
  btc: "bitcoin",
  wbtc: "bitcoin",
  xaut: "gold",
};

const CATEGORY_ICON: Record<CurrencyCategory, IconComponent> = {
  stablecoin: DollarSign,
  bitcoin: Bitcoin,
  sats: SatoshiIcon,
  gold: GoldBar,
};

const ICON_CLASS = "h-6 w-6 md:h-8 md:w-8 text-muted-foreground/70 shrink-0";
const SATS_ICON_CLASS = "h-7 w-7 md:h-9 md:w-9 text-muted-foreground/70 shrink-0";

// ── Exported component ───────────────────────────────────────────────

export function CurrencyIcon({
  symbol,
  isSatsMode,
}: { symbol: string | undefined; isSatsMode: boolean }) {
  if (!symbol) return null;
  const category = SYMBOL_CATEGORY[symbol.toLowerCase()];
  if (!category) return null;
  const effectiveCategory =
    isSatsMode && category === "bitcoin" ? "sats" : category;
  const Icon = CATEGORY_ICON[effectiveCategory];
  return <Icon className={effectiveCategory === "sats" ? SATS_ICON_CLASS : ICON_CLASS} />;
}
