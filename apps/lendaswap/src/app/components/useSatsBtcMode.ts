import { useEffect, useMemo, useState } from "react";

// ── Constants ────────────────────────────────────────────────────────

const BTC_SYMBOLS = new Set(["btc", "wbtc"]);

/** Once the user types this many sats, auto-switch to BTC display. */
const SATS_TO_BTC_THRESHOLD = 100_000; // 0.001 BTC

// ── Helpers ──────────────────────────────────────────────────────────

export function isBtcToken(symbol: string | undefined): boolean {
  return symbol !== undefined && BTC_SYMBOLS.has(symbol.toLowerCase());
}

/** Detect whether an input string represents BTC mode (has a decimal). */
function inputUsesBtcMode(input: string): boolean {
  return input.includes(".");
}

/** Format a number without scientific notation, preserving precision. */
function formatNumber(val: number, maxDecimals = 8): string {
  const fixed = val.toFixed(maxDecimals);
  return fixed.replace(/\.?0+$/, "") || "0";
}

// ── Hook ─────────────────────────────────────────────────────────────

interface UseSatsBtcModeOptions {
  /** External value in smallest unit (sats) — set by parent or quote. */
  value: number | undefined;
  /** Called with the amount in smallest unit when the user edits the input. */
  onChange: (value: number | undefined) => void;
  /** Number of decimal places for this token (8 for BTC). */
  decimals: number | undefined;
  /** Token symbol, e.g. "BTC", "WBTC". */
  symbol: string | undefined;
}

interface SatsBtcMode {
  /** The string shown inside the <input>. */
  inputValue: string;
  /** Whether the input is currently in sats mode (integers). */
  satsMode: boolean;
  /** Whether this token is a BTC-family token at all. */
  isBtc: boolean;
  /** Pass this to the <input onChange>. */
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function useSatsBtcMode({
  value,
  onChange,
  decimals,
  symbol,
}: UseSatsBtcModeOptions): SatsBtcMode {
  const [inputValue, setInputValue] = useState<string>("");

  const isBtc = isBtcToken(symbol);
  const satsMode = isBtc && !inputUsesBtcMode(inputValue);

  // Divisor: 1 in sats mode (input = sats directly), 10^8 in BTC mode.
  const divisor = useMemo(() => {
    if (isBtc && satsMode) return 1;
    return 10 ** (decimals ?? 0);
  }, [isBtc, satsMode, decimals]);

  const displayValue = value !== undefined ? value / divisor : undefined;

  // Sync internal input string when external value changes (e.g. quote)
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
          if (isBtc && !inputUsesBtcMode(prev)) {
            return String(Math.round(displayValue));
          }
          return formatNumber(displayValue, decimals ?? 8);
        }
        return prev;
      });
    }
  }, [displayValue, decimals, isBtc]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/[^0-9.]/g, "");

    if (input === "") {
      setInputValue("");
      onChange(undefined);
      return;
    }

    const isSatsInput = isBtc && !input.includes(".");
    const effectiveDecimals = isSatsInput ? 0 : (decimals ?? 0);

    const regex =
      effectiveDecimals > 0
        ? new RegExp(`^\\d*\\.?\\d{0,${effectiveDecimals}}$`)
        : /^\d*\.?$/;

    if (regex.test(input)) {
      const parsed = Number.parseFloat(input);

      // Auto-convert sats → BTC when threshold is reached
      if (
        isSatsInput &&
        !Number.isNaN(parsed) &&
        parsed >= SATS_TO_BTC_THRESHOLD
      ) {
        const btcValue = parsed / 10 ** (decimals ?? 8);
        setInputValue(formatNumber(btcValue, decimals ?? 8));
        onChange(Math.round(parsed));
        return;
      }

      setInputValue(input);
      if (!Number.isNaN(parsed)) {
        const effectiveDivisor = isSatsInput ? 1 : 10 ** (decimals ?? 0);
        onChange(Math.round(parsed * effectiveDivisor));
      }
    }
  };

  return { inputValue, satsMode, isBtc, handleChange };
}
