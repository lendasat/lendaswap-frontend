import type { TokenInfo } from "@lendasat/lendaswap-sdk-pure";
import type { ReactNode } from "react";
import { getTokenIcon, getTokenNetworkIcon } from "../../utils/tokenUtils";

interface DepositCardProps {
  sourceToken: TokenInfo;
  swapId: string;
  title?: string;
  children: ReactNode;
}

export function DepositCard({
  sourceToken,
  swapId,
  title = "Send BTC",
  children,
}: DepositCardProps) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-muted border border-border">
              <div className="w-5 h-5 flex items-center justify-center">
                {getTokenIcon(sourceToken)}
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background p-[1px] flex items-center justify-center">
              <div className="w-full h-full rounded-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full">
                {getTokenNetworkIcon(sourceToken)}
              </div>
            </div>
          </div>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono text-muted-foreground">
            {swapId.slice(0, 8)}…
          </code>
          <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-5 p-5">{children}</div>
    </div>
  );
}
