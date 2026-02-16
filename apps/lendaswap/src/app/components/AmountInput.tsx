import { useEffect, useState } from "react";
import { Skeleton } from "#/components/ui/skeleton";

type InputMode = "native" | "usd";

interface AmountInputProps {
  /** Current amount in the token's smallest unit (e.g. sats for BTC, 10^-6 for USDC) */
  value: number | undefined;
  /** Called with the amount in smallest unit when the user edits the input */
  onChange: (value: number | undefined) => void;
  /** Number of decimal places for this token (8 for BTC, 6 for USDC, etc.) */
  decimals: number | undefined;
  /** Whether to show "$" prefix (for usd mode) */
  showCurrencyPrefix?: boolean;
  /** Whether the input is loading */
  isLoading?: boolean;
  /** Price of one whole token in USD (e.g., 1 for USDC, ~100000 for BTC) */
  usdPerToken: number;
  /** The token symbol (e.g., "USDC", "BTC") */
  tokenSymbol: string | undefined;
}

/** Format a number as USD with 2 decimal places and thousands separators */
function formatUsd(val: number | undefined): string {
  if (val === undefined) return "0";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a number as BTC with 8 decimal places */
function formatBtc(val: number | undefined): string {
  if (val === undefined) return "0";
  return val.toFixed(8);
}

/** Format a number without scientific notation, preserving precision */
function formatNumber(val: number, maxDecimals = 8): string {
  // Use toFixed to avoid scientific notation for very small numbers
  // Then remove trailing zeros for cleaner display
  const fixed = val.toFixed(maxDecimals);
  // Remove trailing zeros after decimal point, but keep at least one decimal if there's a decimal point
  return fixed.replace(/\.?0+$/, "") || "0";
}

/**
 * A reusable amount input component with decimal validation and mode toggle.
 * Used for both source (sell) and target (buy) amount inputs.
 *
 * Handles string ↔ number conversion internally. Parent components work with numbers.
 * Manages input mode (native/usd) internally.
 *
 * In "native" mode: user types token amount, sees USD equivalent below
 * In "usd" mode: user types USD amount, sees token equivalent below
 * onChange always receives the native token amount.
 */
export function AmountInput({
  value,
  onChange,
  decimals,
  showCurrencyPrefix = false,
  isLoading = false,
  usdPerToken,
  tokenSymbol,
}: AmountInputProps) {
  // Internal string state for the input field
  // This allows intermediate states like "50." while typing
  const [inputValue, setInputValue] = useState<string>("");

  // Internal state for input mode (native token vs USD)
  const [inputMode, setInputMode] = useState<InputMode>("native");

  // Conversion factor: smallest-unit → display (e.g. 10^8 for BTC, 10^6 for USDC)
  const divisor = 10 ** (decimals ?? 0);

  // Display value = smallest-unit value / divisor
  const displayValue = value !== undefined ? value / divisor : undefined;

  // Calculate USD value from display value (1 whole token = usdPerToken USD)
  const usdValue =
    displayValue !== undefined ? displayValue * usdPerToken : undefined;

  // Sync internal state when external value changes (e.g., from calculations)
  // or when mode changes
  useEffect(() => {
    if (displayValue === undefined) {
      const currentNum = Number.parseFloat(inputValue);
      if (!Number.isNaN(currentNum)) {
        setInputValue("");
      }
    } else {
      // Calculate what the input should show based on mode
      const shown =
        inputMode === "native" ? displayValue : displayValue * usdPerToken;

      // Only update if the numeric value actually differs
      // This prevents overwriting "50.0" with "50" while user types
      const currentNum = Number.parseFloat(inputValue);
      if (Number.isNaN(currentNum) || Math.abs(currentNum - shown) > 1e-10) {
        setInputValue(formatNumber(shown, decimals ?? 8));
      }
    }
  }, [displayValue, inputMode, usdPerToken, inputValue, decimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/[^0-9.]/g, "");

    // Allow empty string
    if (input === "") {
      setInputValue("");
      onChange(undefined);
      return;
    }

    // Build regex based on mode
    // In USD mode, allow 2 decimal places; in native mode, use provided decimals
    const maxDecimals = inputMode === "usd" ? 2 : decimals;
    const regex =
      maxDecimals !== undefined
        ? new RegExp(`^\\d*\\.?\\d{0,${maxDecimals}}$`)
        : /^\d*\.?\d*$/;

    if (regex.test(input)) {
      setInputValue(input);

      // Parse and notify parent only if it's a valid number
      const parsed = Number.parseFloat(input);
      if (!Number.isNaN(parsed)) {
        if (inputMode === "usd") {
          // Convert USD → display → smallest unit
          const native = usdPerToken > 0 ? parsed / usdPerToken : 0;
          onChange(Math.round(native * divisor));
        } else {
          // Native mode: convert display value → smallest unit
          onChange(Math.round(parsed * divisor));
        }
      }
    }
  };

  const handleToggle = () => {
    setInputMode((prev) => {
      const newMode = prev === "native" ? "usd" : "native";

      // Convert the current input value to the new mode's format
      if (displayValue !== undefined) {
        if (newMode === "usd") {
          setInputValue(formatNumber(displayValue * usdPerToken, 2));
        } else {
          setInputValue(formatNumber(displayValue, decimals ?? 8));
        }
      }

      return newMode;
    });
  };

  // Format displays based on token type
  const isBtc = tokenSymbol === "BTC";
  const usdDisplay = `≈ $${formatUsd(usdValue)}`;
  const tokenDisplay = isBtc
    ? `≈ ${formatBtc(displayValue)} BTC`
    : `≈ ${formatUsd(displayValue)} ${tokenSymbol}`;

  // Toggle shows the "alternate" representation:
  // - In native mode: show USD equivalent
  // - In usd mode: show token amount
  const toggleText = inputMode === "native" ? usdDisplay : tokenDisplay;

  if (isLoading) {
    return (
      <div className="flex-1 min-w-0">
        <div className="h-10 flex items-center">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="text-sm text-muted-foreground mt-1 opacity-70">
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      <div className="flex items-baseline gap-1 overflow-hidden">
        {/* Currency prefix - show $ only when in usd mode (USD denomination) */}
        {showCurrencyPrefix && inputMode === "usd" && (
          <span className="text-2xl md:text-4xl font-medium text-muted-foreground leading-none">
            $
          </span>
        )}
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
      {/* Clickable toggle between native token and USD */}
      <button
        type="button"
        onClick={handleToggle}
        className="text-sm font-sans text-muted-foreground mt-1 hover:text-foreground hover:opacity-100 opacity-70 transition-all cursor-pointer"
      >
        {toggleText}
      </button>
    </div>
  );
}
