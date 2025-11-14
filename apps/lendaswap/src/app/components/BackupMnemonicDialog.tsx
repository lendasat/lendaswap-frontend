import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { getMnemonic } from "@frontend/browser-wallet";
import { AlertTriangle, Check, Copy } from "lucide-react";

interface BackupMnemonicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackupMnemonicDialog({
  open,
  onOpenChange,
}: BackupMnemonicDialogProps) {
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadMnemonic();
    }
  }, [open]);

  const loadMnemonic = async () => {
    setLoading(true);
    try {
      const phrase = await getMnemonic();
      setMnemonic(phrase);
    } catch (error) {
      console.error("Failed to load mnemonic:", error);
      setMnemonic(null);
    } finally {
      setLoading(false);
    }
  };

  const words = mnemonic ? mnemonic.split(" ") : [];

  const copyWord = async (word: string, index: number) => {
    try {
      await navigator.clipboard.writeText(word);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const copyAll = async () => {
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Backup Your Wallet</DialogTitle>
          <DialogDescription>
            Write down these 12 words in order and store them in a safe place.
            You'll need them to recover your wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Never share this phrase with anyone.</strong> Anyone with
              these words can access your funds. Store them securely offline.
            </AlertDescription>
          </Alert>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                Loading mnemonic...
              </p>
            </div>
          ) : !mnemonic ? (
            <Alert variant="destructive">
              <AlertDescription>
                No mnemonic found. Please try again or contact support.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 ph-no-capture">
                {words.map((word, index) => (
                  <div
                    key={index}
                    className="relative flex items-center gap-2 rounded-md border bg-muted/50 p-3"
                  >
                    <span className="text-xs text-muted-foreground w-6">
                      {index + 1}.
                    </span>
                    <span className="flex-1 font-mono text-sm ph-no-capture">{word}</span>
                    <button
                      onClick={() => copyWord(word, index)}
                      className="p-1 hover:bg-background rounded transition-colors"
                      title="Copy word"
                    >
                      {copiedIndex === index ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyAll}
                  className="gap-2"
                >
                  {copiedAll ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied All Words
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy All Words
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
