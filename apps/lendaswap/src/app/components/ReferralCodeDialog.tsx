import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { setReferralCode } from "../utils/referralCode";

interface ReferralCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCodeAdded: () => void;
}

export function ReferralCodeDialog({
  open,
  onOpenChange,
  onCodeAdded,
}: ReferralCodeDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const normalizedCode = code.trim();

    if (!normalizedCode) {
      setError("Please enter a code");
      return;
    }

    // Save code to localStorage
    setReferralCode(normalizedCode);

    // Clear form and close
    setCode("");
    setError(null);
    onOpenChange(false);
    onCodeAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Your Referral Code</DialogTitle>
          <DialogDescription>
            Enter your referral code to link your swaps.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Referral Code</Label>
            <Input
              id="code"
              placeholder="lnds_myorg_abc123"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setCode("");
              setError(null);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Code</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
