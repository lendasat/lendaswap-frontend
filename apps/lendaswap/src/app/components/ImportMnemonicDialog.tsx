import {
  deriveSwapParamsAtIndex,
  getUserIdXpub,
  importMnemonic,
} from "@frontend/browser-wallet";
import { AlertTriangle, CheckCircle2, FileText, Upload, X } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "#/components/ui/file-upload";
import { Label } from "#/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { Textarea } from "#/components/ui/textarea";
import { api } from "../api";
import { addSwap, clearAllSwaps } from "../db";

interface ImportMnemonicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

type Step = "input" | "success";

export function ImportMnemonicDialog({
  open,
  onOpenChange,
  onImportSuccess,
}: ImportMnemonicDialogProps) {
  const [step, setStep] = useState<Step>("input");
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleClose = () => {
    // Reset state when closing
    setStep("input");
    setMnemonic("");
    setError(null);
    setLoading(false);
    setFiles([]);
    onOpenChange(false);
  };

  const handleFilesChange = async (newFiles: File[]) => {
    setFiles(newFiles);
    setError(null);

    if (newFiles.length === 0) {
      setMnemonic("");
      return;
    }

    const file = newFiles[0];

    // Read the file content
    try {
      const text = await file.text();
      setMnemonic(text.trim().toLowerCase());
    } catch (_err) {
      setError("Failed to read file");
      setFiles([]);
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

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
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

      // Clear all swap data from IndexedDB and localStorage before recovery
      await clearAllSwaps();
      clearLocalStorageSwaps();

      // Recover swaps from the backend using Xpub
      // 1. Get the user_id Xpub from the imported mnemonic
      const xpub = await getUserIdXpub();
      if (!xpub) {
        throw new Error("Failed to derive Xpub from mnemonic");
      }

      console.log(`Recovery: Using Xpub for recovery`);

      // 2. Call the recovery API with the Xpub
      const { swaps: recoveredSwaps, highest_index } =
        await api.recoverSwaps(xpub);

      console.log(
        `Recovery: Found ${recoveredSwaps.length} swaps, highest index: ${highest_index}`,
      );

      // 3. Restore recovered swaps to IndexedDB and localStorage
      for (const recoveredSwap of recoveredSwaps) {
        const { index, ...swap } = recoveredSwap;

        // Re-derive and store swap params for VHTLC operations
        if (swap.direction === "btc_to_evm") {
          // BTC → EVM: derive secret and own_sk
          const {
            preimage: secret,
            ownSk: own_sk,
            ownPk: refund_pk,
          } = await deriveSwapParamsAtIndex(index);

          // Store swap info in IndexedDB
          await addSwap({ ...swap, secret, own_sk, refund_pk });

          localStorage.setItem(
            swap.id,
            JSON.stringify({
              key_index: index,
              secret,
              own_sk,
              lendaswap_pk: swap.receiver_pk,
              arkade_server_pk: swap.server_pk,
              refund_locktime: swap.refund_locktime,
              unilateral_claim_delay: swap.unilateral_claim_delay,
              unilateral_refund_delay: swap.unilateral_refund_delay,
              unilateral_refund_without_receiver_delay:
                swap.unilateral_refund_without_receiver_delay,
              network: swap.network,
              vhtlc_address: swap.htlc_address_arkade,
              created_at: swap.created_at,
              source_token: swap.source_token,
              target_token: swap.target_token,
            }),
          );

          console.log(
            `Recovered BTC→EVM swap ${swap.id} with re-derived keys at index ${index}`,
          );
        } else if (swap.direction === "evm_to_btc") {
          await addSwap(swap);

          // EVM → BTC
          if (swap.target_token === "btc_lightning") {
            // Lightning delivery: don't derive keys (not used)
            localStorage.setItem(
              swap.id,
              JSON.stringify({
                key_index: index,
                lendaswap_pk: swap.sender_pk,
                arkade_server_pk: swap.server_pk,
                refund_locktime: swap.refund_locktime,
                unilateral_claim_delay: swap.unilateral_claim_delay,
                unilateral_refund_delay: swap.unilateral_refund_delay,
                unilateral_refund_without_receiver_delay:
                  swap.unilateral_refund_without_receiver_delay,
                network: swap.network,
                vhtlc_address: swap.htlc_address_arkade,
                created_at: swap.created_at,
                source_token: swap.source_token,
                target_token: swap.target_token,
              }),
            );

            console.log(
              `Recovered EVM→Lightning swap ${swap.id} (no key derivation needed) at index ${index}`,
            );
          } else {
            // Arkade delivery: derive secret, own_sk, and receiver_pk
            const {
              preimage: secret,
              ownSk: own_sk,
              ownPk: receiver_pk,
            } = await deriveSwapParamsAtIndex(index);

            // Store swap info in IndexedDB
            await addSwap({ ...swap, secret, own_sk, receiver_pk });

            localStorage.setItem(
              swap.id,
              JSON.stringify({
                key_index: index,
                secret,
                own_sk,
                receiver_pk,
                lendaswap_pk: swap.sender_pk,
                arkade_server_pk: swap.server_pk,
                refund_locktime: swap.refund_locktime,
                unilateral_claim_delay: swap.unilateral_claim_delay,
                unilateral_refund_delay: swap.unilateral_refund_delay,
                unilateral_refund_without_receiver_delay:
                  swap.unilateral_refund_without_receiver_delay,
                network: swap.network,
                vhtlc_address: swap.htlc_address_arkade,
                created_at: swap.created_at,
                source_token: swap.source_token,
                target_token: swap.target_token,
              }),
            );

            console.log(
              `Recovered EVM→Arkade swap ${swap.id} with re-derived keys at index ${index}`,
            );
          }
        }
      }

      // 4. Set the key derivation index to the highest recovered index + 1
      const nextIndex = highest_index + 1;
      localStorage.setItem("lendaswap_hd_index", nextIndex.toString());

      console.log(
        `Recovery complete: ${recoveredSwaps.length} swaps restored, next key index: ${nextIndex}`,
      );

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
        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Wallet</DialogTitle>
              <DialogDescription>
                Upload a recovery phrase file or enter it manually to restore
                your wallet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Importing a wallet will permanently
                  erase all your current swap data and cannot be undone.
                </AlertDescription>
              </Alert>
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" className="gap-2">
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload File</span>
                    <span className="sm:hidden">Upload</span>
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Enter Manually</span>
                    <span className="sm:hidden">Manual</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4 mt-4">
                  <FileUpload
                    maxFiles={1}
                    maxSize={1024 * 1024} // 1MB
                    accept=".txt,text/plain"
                    value={files}
                    onValueChange={handleFilesChange}
                    disabled={loading}
                  >
                    <FileUploadDropzone>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <div className="flex items-center justify-center rounded-full border p-2.5">
                          <Upload className="size-6 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-sm">
                          Drop recovery phrase file here
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Or click to browse (.txt file)
                        </p>
                      </div>
                      <FileUploadTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 w-fit"
                        >
                          Browse files
                        </Button>
                      </FileUploadTrigger>
                    </FileUploadDropzone>
                    <FileUploadList>
                      {files.map((file) => (
                        <FileUploadItem key={file.name} value={file}>
                          <FileUploadItemPreview />
                          <FileUploadItemMetadata />
                          <FileUploadItemDelete asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-1"
                            >
                              <X />
                            </Button>
                          </FileUploadItemDelete>
                        </FileUploadItem>
                      ))}
                    </FileUploadList>
                  </FileUpload>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="mnemonic">Recovery Phrase (12 words)</Label>
                    <Textarea
                      id="mnemonic"
                      placeholder="word1 word2 word3 ... word12"
                      value={mnemonic}
                      onChange={(e) => {
                        setMnemonic(e.target.value.toLowerCase());
                        setError(null);
                        setFiles([]);
                      }}
                      rows={3}
                      className="font-mono text-sm ph-no-capture"
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter all 12 words separated by spaces, in lowercase.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || !mnemonic}
                className="flex-1"
              >
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
