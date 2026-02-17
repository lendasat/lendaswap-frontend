import { CheckCheck, Copy, ExternalLink } from "lucide-react";
import { Button } from "#/components/ui/button";
import { useCopyToClipboard } from "./useCopyToClipboard";

interface AddressDisplayProps {
  label: string;
  value: string;
  explorerUrl?: string;
}

function shortenAddress(address: string, startChars = 12, endChars = 12) {
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

export function AddressDisplay({
  label,
  value,
  explorerUrl,
}: AddressDisplayProps) {
  const { copiedValue, handleCopy } = useCopyToClipboard();

  return (
    <div className="w-full space-y-2">
      <div className="text-muted-foreground text-sm font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <div className="dark:bg-muted/50 border-border flex-1 rounded-lg border bg-white p-3 font-mono text-xs">
          <span className="md:hidden">{shortenAddress(value)}</span>
          <span className="hidden md:inline break-all">{value}</span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleCopy(value)}
          className="shrink-0"
        >
          {copiedValue === value ? (
            <CheckCheck className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          View on mempool.space <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
