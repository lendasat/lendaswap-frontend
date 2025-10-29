import { Check, CheckCheck, Copy, ExternalLink } from "lucide-react";
import { Button } from "#/components/ui/button";
import { CardContent } from "#/components/ui/card";
import { useNavigate } from "react-router";
import type { SwapResponse } from "../api";
import { SuccessMeme } from "../components/SuccessMeme";

interface SuccessStepProps {
  swapData: SwapResponse | null;
  usdcAmount: string;
  receiveAddress: string;
  swapTxId: string | null;
  copiedAddress: string | null;
  handleCopyAddress: (address: string) => void;
  swapDurationSeconds: number | null;
}

export function SuccessStep({
  swapData,
  usdcAmount,
  receiveAddress,
  swapTxId,
  copiedAddress,
  handleCopyAddress,
  swapDurationSeconds,
}: SuccessStepProps) {
  const navigate = useNavigate();

  const handleStartNewSwap = () => {
    // Navigate to home page to start a new swap
    navigate("/", { replace: true });
  };

  return (
    <CardContent className="py-12">
      <div className="flex flex-col items-center space-y-6">
        {/* Success Icon */}
        <div className="bg-foreground flex h-16 w-16 items-center justify-center rounded-full">
          <Check className="text-background h-8 w-8" />
        </div>

        {/* Success Message */}
        <div className="space-y-2 text-center">
          <h3 className="text-2xl font-semibold">Swap Complete!</h3>
          <p className="text-muted-foreground text-sm">
            Your USDC has been successfully sent to your address
          </p>
        </div>

        {/* Success Meme with Share Button */}
        <SuccessMeme
          swapDurationSeconds={swapDurationSeconds}
          usdcAmount={usdcAmount}
        />

        {/* Transaction Details */}
        <div className="bg-muted/50 w-full max-w-md space-y-3 rounded-lg p-4">
          <h4 className="mb-3 text-sm font-medium">Transaction Details</h4>
          {swapData?.id && (
            <div className="border-border flex flex-col gap-2 border-b pb-2 text-sm">
              <span className="text-muted-foreground">Swap ID</span>
              <div className="flex items-center gap-2">
                <span className="flex-1 break-all font-mono text-xs">
                  {swapData.id}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyAddress(swapData.id)}
                  className="h-8 w-8 shrink-0"
                >
                  {copiedAddress === swapData.id ? (
                    <CheckCheck className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount Sent</span>
            <span className="font-medium">
              {swapData?.sats_required.toLocaleString()} sats
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount Received</span>
            <span className="font-medium">{usdcAmount} USDC</span>
          </div>
          <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
            <span className="text-muted-foreground">Sent to Address</span>
            <div className="flex items-center gap-2">
              <a
                href={`https://polygonscan.com/address/${receiveAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 break-all font-mono text-xs hover:underline"
              >
                {receiveAddress}
              </a>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopyAddress(receiveAddress)}
                  className="h-8 w-8"
                >
                  {copiedAddress === receiveAddress ? (
                    <CheckCheck className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button size="icon" variant="ghost" asChild className="h-8 w-8">
                  <a
                    href={`https://polygonscan.com/address/${receiveAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
          <div className="border-border flex flex-col gap-2 border-t pt-2 text-sm">
            <span className="text-muted-foreground">Transaction Hash</span>
            {swapTxId ? (
              <div className="flex items-center gap-2">
                <a
                  href={`https://polygonscan.com/tx/${swapTxId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 break-all font-mono text-xs hover:underline"
                >
                  {swapTxId}
                </a>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopyAddress(swapTxId)}
                    className="h-8 w-8"
                  >
                    {copiedAddress === swapTxId ? (
                      <CheckCheck className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    asChild
                    className="h-8 w-8"
                  >
                    <a
                      href={`https://polygonscan.com/tx/${swapTxId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground font-mono text-xs">
                N/A
              </span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <Button
          className="h-12 w-full max-w-md text-base font-semibold"
          onClick={handleStartNewSwap}
        >
          Start New Swap
        </Button>
      </div>
    </CardContent>
  );
}
