import { Skeleton } from "#/components/ui/skeleton";
import { CurrencyIcon } from "./CurrencyIcon";
import { useSatsBtcMode } from "./useSatsBtcMode";

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

export function AmountInput({
  value,
  onChange,
  decimals,
  isLoading = false,
  symbol,
}: AmountInputProps) {
  const { inputValue, satsMode, isBtc, handleChange } = useSatsBtcMode({
    value,
    onChange,
    decimals,
    symbol,
  });

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
      <CurrencyIcon symbol={symbol} isSatsMode={satsMode} />
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
      {satsMode && isBtc && (
        <span className="text-sm md:text-base text-muted-foreground/60 shrink-0 self-end mb-0.5 md:mb-1">
          sats
        </span>
      )}
    </div>
  );
}
