import { Bitcoin, DollarSign } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useEffect, useState } from "react";
import { Skeleton } from "#/components/ui/skeleton";

// ── Currency icon mapping ────────────────────────────────────────────
// Maps token symbols to their visual prefix icon. Grouped by category
// so new tokens can be added in one place.

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
      {/* Trapezoid gold bar shape */}
      <path d="M8 6h8l3 12H5z" />
      {/* Top shine line */}
      <path d="M10 6l1 5" />
    </svg>
  );
}

type CurrencyCategory = "stablecoin" | "bitcoin" | "gold";

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

type IconComponent = ComponentType<{ className?: string }>;

const CATEGORY_ICON: Record<CurrencyCategory, IconComponent> = {
  stablecoin: DollarSign,
  bitcoin: Bitcoin,
  gold: GoldBar,
};

const ICON_CLASS = "h-5 w-5 md:h-7 md:w-7 text-muted-foreground/70 shrink-0";

function CurrencyIcon({ symbol }: { symbol: string | undefined }) {
  if (!symbol) return null;
  const category = SYMBOL_CATEGORY[symbol.toLowerCase()];
  if (!category) return null;
  const Icon = CATEGORY_ICON[category];
  return <Icon className={ICON_CLASS} />;
}

// ── AmountInput ──────────────────────────────────────────────────────

interface AmountInputProps {
  /** Current amount in the token's smallest unit (e.g. sats for BTC, 10^-6 for USDC) */
  value: number | undefined;
  /** Called with the amount in smallest unit when the user edits the input */
  onChange: (value: number | undefined) => void;
  /** Number of decimal places for this token (8 for BTC, 6 for USDC, etc.) */
  decimals: number | undefined;
  /** Whether the input is loading */
  isLoading?: boolean;
  /** Token symbol used to determine the currency icon (e.g. "BTC", "USDC", "XAUt") */
  symbol?: string;
}

/** Format a number without scientific notation, preserving precision */
function formatNumber(val: number, maxDecimals = 8): string {
  const fixed = val.toFixed(maxDecimals);
  return fixed.replace(/\.?0+$/, "") || "0";
}

export function AmountInput({
  value,
  onChange,
  decimals,
  isLoading = false,
  symbol,
}: AmountInputProps) {
  const [inputValue, setInputValue] = useState<string>("");

  const divisor = 10 ** (decimals ?? 0);
  const displayValue = value !== undefined ? value / divisor : undefined;

  // Sync internal input string when external value changes (e.g. other side recalculated)
  useEffect(() => {
    if (displayValue === undefined) {
      setInputValue((prev) => {
        const currentNum = Number.parseFloat(prev);
        return Number.isNaN(currentNum) ? prev : "";
      });
    } else {
      setInputValue((prev) => {
        const currentNum = Number.parseFloat(prev);
        if (
          Number.isNaN(currentNum) ||
          Math.abs(currentNum - displayValue) > 1e-10
        ) {
          return formatNumber(displayValue, decimals ?? 8);
        }
        return prev;
      });
    }
  }, [displayValue, decimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/[^0-9.]/g, "");

    if (input === "") {
      setInputValue("");
      onChange(undefined);
      return;
    }

    const regex =
      decimals !== undefined
        ? new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`)
        : /^\d*\.?\d*$/;

    if (regex.test(input)) {
      setInputValue(input);
      const parsed = Number.parseFloat(input);
      if (!Number.isNaN(parsed)) {
        onChange(Math.round(parsed * divisor));
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-w-0">
        <div className="h-10 flex items-center">
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-1">
      <CurrencyIcon symbol={symbol} />
      <input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleChange}
        placeholder="0"
        style={{
          touchAction: "manipulation",
          overflowY: "hidden",
          overscrollBehavior: "none",
        }}
        className="w-full p-0 m-0 border-0 bg-transparent text-2xl md:text-4xl !leading-[1] !h-[1em] font-sans font-medium outline-none appearance-none placeholder:text-muted-foreground/50"
        data-1p-ignore
        data-lpignore="true"
        autoComplete="off"
      />
    </div>
  );
}
