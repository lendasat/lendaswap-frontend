import { useEffect, useState } from "react";
import { Skeleton } from "#/components/ui/skeleton";

interface AmountInputProps {
  /** Current amount in the token's smallest unit (e.g. sats for BTC, 10^-6 for USDC) */
  value: number | undefined;
  /** Called with the amount in smallest unit when the user edits the input */
  onChange: (value: number | undefined) => void;
  /** Number of decimal places for this token (8 for BTC, 6 for USDC, etc.) */
  decimals: number | undefined;
  /** Whether the input is loading */
  isLoading?: boolean;
  /** USD price per display unit (i.e. per sat for BTC, per 1 USDC for USDC) */
  usdPerToken: number;
  /** The token symbol (e.g., "USDC", "BTC") */
  tokenSymbol: string | undefined;
}

/** Format a number as USD with 2 decimal places and thousands separators */
function formatUsd(val: number | undefined): string {
  if (val === undefined || val === 0) return "$0.00";
  return `$${val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  usdPerToken,
}: AmountInputProps) {
  const [inputValue, setInputValue] = useState<string>("");

  const divisor = 10 ** (decimals ?? 0);
  const displayValue = value !== undefined ? value / divisor : undefined;
  const usdValue =
    displayValue !== undefined ? displayValue * usdPerToken : undefined;

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
        <div className="text-sm text-muted-foreground mt-1 opacity-70">
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
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
      <div className="text-sm font-sans text-muted-foreground mt-1 opacity-70">
        {formatUsd(usdValue)}
      </div>
    </div>
  );
}