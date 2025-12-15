import { useEffect, useState } from "react";
import { Skeleton } from "#/components/ui/skeleton";

type InputMode = "native" | "usd";

interface AmountInputProps {
  /** Current amount value in native tokens (number) */
  value: number | undefined;
  /** Called when user changes the input with the parsed native token value */
  onChange: (value: number | undefined) => void;
  /** Maximum decimal places allowed for native token input */
  decimals: number | undefined;
  /** Whether to show "$" prefix (for usd mode) */
  showCurrencyPrefix?: boolean;
  /** Whether the input is loading */
  isLoading?: boolean;
  /** Price of one token in USD (e.g., 1 for USDC, ~100000 for BTC) */
  usdPerToken: number;
  /** The token symbol (e.g., "USDC", "BTC") */
  tokenSymbol: string;
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

  // Calculate USD value from native value
  const usdValue = value !== undefined ? value * usdPerToken : undefined;

  // Sync internal state when external value changes (e.g., from calculations)
  // or when mode changes
  useEffect(() => {
    if (value === undefined) {
      // Only clear if the current input is a valid number that differs
      // Don't clear if user is actively typing something like "50."
      const currentNum = Number.parseFloat(inputValue);
      if (!Number.isNaN(currentNum)) {
        setInputValue("");
      }
    } else {
      // Calculate the display value based on mode
      const displayValue = inputMode === "native" ? value : value * usdPerToken;

      // Only update if the numeric value actually differs
      // This prevents overwriting "50.0" with "50" while user types
      const currentNum = Number.parseFloat(inputValue);
      if (
        Number.isNaN(currentNum) ||
        Math.abs(currentNum - displayValue) > 0.0000001
      ) {
        setInputValue(String(displayValue));
      }
    }
  }, [value, inputMode, usdPerToken, inputValue]);

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
          // Convert USD to native tokens: nativeAmount = usdAmount / usdPerToken
          const nativeAmount = usdPerToken > 0 ? parsed / usdPerToken : 0;
          onChange(nativeAmount);
        } else {
          // Native mode: pass the value directly
          onChange(parsed);
        }
      }
      // If input ends with "." or is otherwise not a complete number,
      // we keep the string state but don't notify parent yet
    }
  };

  const handleToggle = () => {
    setInputMode((prev) => {
      const newMode = prev === "native" ? "usd" : "native";

      // Convert the current input value to the new mode's format
      if (value !== undefined) {
        if (newMode === "usd") {
          // Switching to USD mode: show USD value
          setInputValue(String(value * usdPerToken));
        } else {
          // Switching to native mode: show native value
          setInputValue(String(value));
        }
      }

      return newMode;
    });
  };

  // Format displays based on token type
  const isBtc = tokenSymbol === "BTC";
  const usdDisplay = `≈ $${formatUsd(usdValue)}`;
  const tokenDisplay = isBtc
    ? `≈ ${formatBtc(value)} BTC`
    : `≈ ${formatUsd(value)} ${tokenSymbol}`;

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
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-1">
        {/* Currency prefix - show $ only when in usd mode (USD denomination) */}
        {showCurrencyPrefix && inputMode === "usd" && (
          <span className="text-2xl md:text-4xl font-medium text-muted-foreground">
            $
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          placeholder="0"
          className="w-full bg-transparent text-2xl md:text-4xl font-medium outline-none placeholder:text-muted-foreground/50"
          data-1p-ignore
          data-lpignore="true"
          autoComplete="off"
        />
      </div>
      {/* Clickable toggle between native token and USD */}
      <button
        type="button"
        onClick={handleToggle}
        className="text-sm text-muted-foreground mt-1 hover:text-foreground hover:opacity-100 opacity-70 transition-all cursor-pointer"
      >
        {toggleText}
      </button>
    </div>
  );
}
