import { Loader2, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { SupportErrorBanner } from "../../components/SupportErrorBanner";

interface DepositActionsProps {
  onSendFromWallet?: () => Promise<void>;
  onCancel: () => void;
  isSending?: boolean;
  sendError?: string | null;
  swapId?: string;
  extraButtons?: ReactNode;
}

export function DepositActions({
  onSendFromWallet,
  onCancel,
  isSending = false,
  sendError,
  swapId,
  extraButtons,
}: DepositActionsProps) {
  return (
    <>
      {/* Send Error */}
      {sendError && (
        <SupportErrorBanner
          message="Failed to send payment"
          error={sendError}
          swapId={swapId}
        />
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        {extraButtons}

        {/* Send from wallet */}
        {onSendFromWallet && (
          <Button
            variant="outline"
            className="h-12 w-full text-base font-semibold order-first md:order-2"
            onClick={onSendFromWallet}
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-5 w-5" />
                Send from Wallet
              </>
            )}
          </Button>
        )}

        {/* Waiting for payment */}
        <Button
          className="h-12 w-full text-base font-semibold order-2 md:order-first"
          disabled={true}
        >
          Waiting for payment
        </Button>

        {/* Cancel button */}
        <Button
          variant="outline"
          className="h-12 w-full order-last"
          onClick={onCancel}
        >
          Cancel Swap
        </Button>
      </div>
    </>
  );
}
