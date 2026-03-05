import { CheckCheck, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { useCopyToClipboard } from "./useCopyToClipboard";

interface AmountRowProps {
  label: string;
  value: string;
  copyValue?: string;
  copiable?: boolean;
}

export function AmountRow({
  label,
  value,
  copyValue,
  copiable,
}: AmountRowProps) {
  const { copiedValue, handleCopy } = useCopyToClipboard();
  const textToCopy = copyValue ?? value;

  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium">{value}</span>
        {copiable && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleCopy(textToCopy)}
            className="h-6 w-6"
          >
            {copiedValue === textToCopy ? (
              <CheckCheck className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

interface AmountSummaryProps {
  children: ReactNode;
}

export function AmountSummary({ children }: AmountSummaryProps) {
  return <div className="bg-muted/50 space-y-2 rounded-lg p-4">{children}</div>;
}
