import { Check, Copy, ArrowRight, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { format } from "date-fns";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { getAllSwaps, deleteSwap, clearAllSwaps, type StoredSwap } from "../db";
import type { TokenId } from "../api";
import { ReactComponent as BitcoinIcon } from "../../assets/bitcoin.svg";
import { ReactComponent as BitcoinLightningIcon } from "../../assets/bitcoin_lightning.svg";
import { ReactComponent as UsdcIcon } from "../../assets/usdc.svg";
import { ReactComponent as TetherIcon } from "../../assets/usdt0.svg";

export function SwapsPage() {
  const [swaps, setSwaps] = useState<StoredSwap[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [swapToDelete, setSwapToDelete] = useState<string | null>(null);
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

  const getTokenIcon = (tokenId: TokenId) => {
    switch (tokenId) {
      case "btc_arkade":
        return <BitcoinIcon className="h-6 w-6" />;
      case "btc_lightning":
        return <BitcoinLightningIcon className="h-6 w-6" />;
      case "usdc_pol":
        return <UsdcIcon className="h-6 w-6" />;
      case "usdt0_pol":
        return <TetherIcon className="h-6 w-6" />;
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

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Your Swaps</h1>
        {swaps.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleClearAllClick}>
            Clear History
          </Button>
        )}
      </div>

      {swaps.length === 0 ? (
        <Alert>
          <AlertDescription>
            No swaps found in local storage. Create a swap first to see it here.
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
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
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
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
    </div>
  );
}
