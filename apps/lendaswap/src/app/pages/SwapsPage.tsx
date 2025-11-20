import {getMnemonic} from "@frontend/browser-wallet";
import {format} from "date-fns";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Trash2,
  Upload,
} from "lucide-react";
import {useEffect, useState} from "react";
import {useNavigate} from "react-router";
import {Alert, AlertDescription} from "#/components/ui/alert";
import {Button} from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import {getTokenIcon} from "../api";
import {ImportMnemonicDialog} from "../components/ImportMnemonicDialog";
import {VersionFooter} from "../components/VersionFooter";
import {clearAllSwaps, deleteSwap, getAllSwaps, type StoredSwap} from "../db";

export function SwapsPage() {
  const [swaps, setSwaps] = useState<StoredSwap[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [swapToDelete, setSwapToDelete] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSeedphrase, setShowSeedphrase] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [copiedWordIndex, setCopiedWordIndex] = useState<number | null>(null);
  const [copiedAllWords, setCopiedAllWords] = useState(false);
  const navigate = useNavigate();

  const handleCopyId = async (e: React.MouseEvent, swapId: string) => {
    e.stopPropagation(); // Prevent row click when copying
    try {
      await navigator.clipboard.writeText(swapId);
      setCopiedId(swapId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy swap ID:", error);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, swapId: string) => {
    e.stopPropagation(); // Prevent row click when deleting
    setSwapToDelete(swapId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!swapToDelete) return;

    try {
      await deleteSwap(swapToDelete);
      setSwaps((prevSwaps) => prevSwaps.filter((s) => s.id !== swapToDelete));
      setDeleteDialogOpen(false);
      setSwapToDelete(null);
    } catch (error) {
      console.error("Failed to delete swap:", error);
    }
  };

  const handleClearAllClick = () => {
    setClearAllDialogOpen(true);
  };

  const handleClearAllConfirm = async () => {
    try {
      await clearAllSwaps();
      setSwaps([]);
      setClearAllDialogOpen(false);
    } catch (error) {
      console.error("Failed to clear all swaps:", error);
    }
  };

  const handleDownloadSeedphrase = async () => {
    setIsDownloading(true);
    try {
      const mnemonic = await getMnemonic();

      if (!mnemonic) {
        console.error("No mnemonic found");
        return;
      }

      // Create a blob with the mnemonic
      const blob = new Blob([mnemonic], {type: "text/plain"});
      const url = URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `lendaswap-phrase-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download mnemonic:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleImportSuccess = () => {
    // Reload the page to refresh wallet state
    window.location.reload();
  };

  const handleToggleSeedphrase = async () => {
    if (!showSeedphrase && !mnemonic) {
      // Load mnemonic when showing for the first time
      try {
        const phrase = await getMnemonic();
        setMnemonic(phrase);
      } catch (error) {
        console.error("Failed to load mnemonic:", error);
        return;
      }
    }
    setShowSeedphrase(!showSeedphrase);
  };

  const handleCopyWord = async (word: string, index: number) => {
    try {
      await navigator.clipboard.writeText(word);
      setCopiedWordIndex(index);
      setTimeout(() => setCopiedWordIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy word:", error);
    }
  };

  const handleCopyAllWords = async () => {
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopiedAllWords(true);
      setTimeout(() => setCopiedAllWords(false), 2000);
    } catch (error) {
      console.error("Failed to copy all words:", error);
    }
  };

  // Load all swaps from Dexie
  useEffect(() => {
    const loadSwaps = async () => {
      try {
        console.log("Loading swaps from Dexie...");
        const dexieSwaps = await getAllSwaps();
        console.log(
          `Loaded ${dexieSwaps.length} swaps from Dexie:`,
          dexieSwaps,
        );

        setSwaps(dexieSwaps);
      } catch (error) {
        console.error("Failed to load swaps from Dexie:", error);
      }
    };

    loadSwaps();
  }, []);

  const words = mnemonic ? mnemonic.split(" ") : [];

  return (
    <>
      <div className="container max-w-6xl mx-auto py-4 sm:py-8 px-4 h-screen flex flex-col">
        <div className="flex flex-col items-center gap-4 mb-4">
          {/* Seedphrase display section */}
          <div className="w-full max-w-3xl">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleSeedphrase}
              className="gap-1.5 text-xs sm:text-sm w-full sm:w-auto"
            >
              {showSeedphrase ? (
                <>
                  <EyeOff className="h-4 w-4"/>
                  <span>Hide Seedphrase</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4"/>
                  <span>Show Seedphrase</span>
                </>
              )}
            </Button>

            {showSeedphrase && mnemonic && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/30 ph-no-capture">
                <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
                  <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
                    <strong>Never share this phrase with anyone.</strong> Anyone
                    with these words can access your funds.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {words.map((word, index) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: "using index here is ok, this list never changes"
                      key={index}
                      className="relative flex items-center gap-2 rounded-md border bg-background p-3"
                    >
                      <span className="text-xs text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <span className="flex-1 font-mono text-sm ph-no-capture">
                        {word}
                      </span>
                      <button
                        type={"button"}
                        onClick={() => handleCopyWord(word, index)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Copy word"
                      >
                        {copiedWordIndex === index ? (
                          <Check className="h-3 w-3 text-green-500"/>
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground"/>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAllWords}
                    className="gap-2"
                  >
                    {copiedAllWords ? (
                      <>
                        <Check className="h-4 w-4"/>
                        Copied All Words
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4"/>
                        Copy All Words
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-center items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSeedphrase}
              disabled={isDownloading}
              className="gap-1.5 text-xs sm:text-sm"
            >
              <Download className="h-4 w-4"/>
              <span className="hidden sm:inline">
                {isDownloading ? "Downloading..." : "Download Seedphrase"}
              </span>
              <span className="sm:hidden">
                {isDownloading ? "Downloading..." : "Backup"}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              className="gap-1.5 text-xs sm:text-sm"
            >
              <Upload className="h-4 w-4"/>
              <span className="hidden sm:inline">Import Seedphrase</span>
              <span className="sm:hidden">Restore</span>
            </Button>
            {swaps.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAllClick}
                className="gap-1.5 text-xs sm:text-sm"
              >
                <Trash2 className="h-4 w-4"/>
                <span className="hidden sm:inline">Clear History</span>
                <span className="sm:hidden">Clear</span>
              </Button>
            )}
          </div>
        </div>

        {swaps.length === 0 ? (
          <Alert>
            <AlertDescription>
              No swaps found in local storage. Create a swap first to see it
              here.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border rounded-lg overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead>Swap ID</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {swaps.map((swap) => (
                  <TableRow
                    key={swap.id}
                    onClick={() => navigate(`/swap/${swap.id}/wizard`)}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(swap.created_at, "dd-MMM-yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTokenIcon(swap.source_token)}
                        <ArrowRight className="h-4 w-4 text-muted-foreground"/>
                        {getTokenIcon(swap.target_token)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <span>
                          {swap.id.slice(0, 8)}...{swap.id.slice(-8)}
                        </span>
                        <button
                          type={"button"}
                          onClick={(e) => handleCopyId(e, swap.id)}
                          className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent hover:text-accent-foreground transition-colors"
                          title="Copy full swap ID"
                        >
                          {copiedId === swap.id ? (
                            <Check className="h-3 w-3 text-green-600"/>
                          ) : (
                            <Copy className="h-3 w-3"/>
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type={"button"}
                        onClick={(e) => handleDeleteClick(e, swap.id)}
                        className="inline-flex items-center justify-center rounded-md p-1 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Delete swap"
                      >
                        <Trash2 className="h-4 w-4"/>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Version information */}
      <div className="pb-6">
        <VersionFooter/>
      </div>

      {/* Delete single swap dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Swap</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this swap? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear all swaps dialog */}
      <Dialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All History</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {swaps.length} swap
              {swaps.length !== 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearAllDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearAllConfirm}>
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import seedphrase dialog */}
      <ImportMnemonicDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportSuccess={handleImportSuccess}
      />
    </>
  );
}
