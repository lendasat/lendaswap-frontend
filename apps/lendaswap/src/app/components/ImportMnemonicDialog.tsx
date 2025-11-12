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
import { Textarea } from "#/components/ui/textarea";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { importMnemonic } from "@frontend/browser-wallet";
import { clearAllSwaps } from "../db";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface ImportMnemonicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

type Step = "warning" | "input" | "success";

export function ImportMnemonicDialog({
  open,
  onOpenChange,
  onImportSuccess,
}: ImportMnemonicDialogProps) {
  const [step, setStep] = useState<Step>("warning");
  const [confirmText, setConfirmText] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    // Reset state when closing
    setStep("warning");
    setConfirmText("");
    setMnemonic("");
    setError(null);
    setLoading(false);
    onOpenChange(false);
  };

  const handleWarningConfirm = () => {
    if (confirmText.toUpperCase() === "DELETE") {
      setStep("input");
      setConfirmText("");
    }
  };

  const validateMnemonic = (phrase: string): string | null => {
    const words = phrase.trim().split(/\s+/);
    if (words.length !== 12) {
      return "Mnemonic must be exactly 12 words";
    }
    // Check each word is alphanumeric (BIP-39 words are all lowercase letters)
    for (const word of words) {
      if (!/^[a-z]+$/.test(word)) {
        return `Invalid word: "${word}". Words must contain only lowercase letters`;
      }
    }
    return null;
  };

  const clearLocalStorageSwaps = () => {
    // Clear all swap-related entries from localStorage
    // Swap IDs are UUIDs (e.g., "550e8400-e29b-41d4-a716-446655440000")
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && uuidPattern.test(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  };

  const resetKeyIndex = () => {
    // Reset the HD wallet key index to 0
    localStorage.setItem("lendaswap_hd_index", "0");
  };

  const handleImport = async () => {
    const trimmedMnemonic = mnemonic.trim().toLowerCase();

    // Validate format
    const validationError = validateMnemonic(trimmedMnemonic);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Import the mnemonic (validates and stores it)
      await importMnemonic(trimmedMnemonic);

      // Clear all swap data from IndexedDB
      await clearAllSwaps();

      // Clear swap entries from localStorage
      clearLocalStorageSwaps();

      // Reset the key derivation index
      resetKeyIndex();

      // Show success
      setStep("success");
      setMnemonic("");

      // Notify parent and close after a delay
      setTimeout(() => {
        onImportSuccess();
        handleClose();
      }, 2000);
    } catch (err) {
      console.error("Failed to import mnemonic:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to import mnemonic. Please check the phrase and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "warning" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Warning: Data Will Be Erased
              </DialogTitle>
              <DialogDescription>
                Importing a new wallet will permanently erase all your current
                swap data.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertDescription>
                  <strong>Before proceeding:</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>Back up your current wallet's 12-word phrase</li>
                    <li>
                      All pending and completed swap records will be deleted
                    </li>
                    <li>This action cannot be undone</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="confirm">
                  Type <strong>DELETE</strong> to confirm
                </Label>
                <Input
                  id="confirm"
                  placeholder="DELETE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="font-mono uppercase"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleWarningConfirm}
                disabled={confirmText.toUpperCase() !== "DELETE"}
              >
                I Understand, Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Wallet</DialogTitle>
              <DialogDescription>
                Enter your 12-word recovery phrase to restore your wallet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="mnemonic">Recovery Phrase (12 words)</Label>
                <Textarea
                  id="mnemonic"
                  placeholder="word1 word2 word3 ... word12"
                  value={mnemonic}
                  onChange={(e) => {
                    setMnemonic(e.target.value.toLowerCase());
                    setError(null);
                  }}
                  rows={3}
                  className="font-mono text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter all 12 words separated by spaces, in lowercase.
                </p>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={loading || !mnemonic}>
                {loading ? "Importing..." : "Import Wallet"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Wallet Imported Successfully
              </DialogTitle>
              <DialogDescription>
                Your wallet has been restored. All previous swap data has been
                cleared.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
