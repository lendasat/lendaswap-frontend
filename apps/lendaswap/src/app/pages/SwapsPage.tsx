import type { ExtendedSwapStorageData } from "@lendasat/lendaswap-sdk";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Loader2,
  MoreHorizontal,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { api, getTokenIcon, getTokenSymbol, SwapStatus } from "../api";
import { VersionFooter } from "../components/VersionFooter";

// Get status display info
function getStatusInfo(status: SwapStatus): {
  label: string;
  textColor: string;
  icon: React.ReactNode;
  showIcon: boolean;
} {
  switch (status) {
    // Success state - swap fully completed
    case SwapStatus.ServerRedeemed:
      return {
        label: "Completed",
        textColor: "text-green-600 dark:text-green-400",
        icon: <Check className="h-3 w-3" />,
        showIcon: true,
      };
    // In progress states
    case SwapStatus.Pending:
    case SwapStatus.ClientFunded:
    case SwapStatus.ServerFunded:
    case SwapStatus.ClientRedeeming:
    case SwapStatus.ClientRedeemed:
      return {
        label: "In Progress",
        textColor: "text-orange-600 dark:text-orange-400",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        showIcon: true,
      };
    // Refunded/expired states
    case SwapStatus.Expired:
    case SwapStatus.ClientRefunded:
    case SwapStatus.ClientRefundedServerRefunded:
    case SwapStatus.ClientFundedServerRefunded:
      return {
        label: status === SwapStatus.Expired ? "Expired" : "Refunded",
        textColor: "text-muted-foreground",
        icon: null,
        showIcon: false,
      };
    // Error states requiring user action
    case SwapStatus.ClientInvalidFunded:
    case SwapStatus.ClientFundedTooLate:
    case SwapStatus.ClientRefundedServerFunded:
      return {
        label: "Action Required",
        textColor: "text-red-600 dark:text-red-400",
        icon: null,
        showIcon: false,
      };
    default:
      return {
        label: "Unknown",
        textColor: "text-muted-foreground",
        icon: null,
        showIcon: false,
      };
  }
}

export function SwapsPage() {
  const [swaps, setSwaps] = useState<ExtendedSwapStorageData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [corruptedDialogOpen, setCorruptedDialogOpen] = useState(false);
  const [swapToDelete, setSwapToDelete] = useState<string | null>(null);
  const [corruptedIds, setCorruptedIds] = useState<string[]>([]);
  const [isDeletingCorrupted, setIsDeletingCorrupted] = useState(false);
  const [isRepairingCorrupted, setIsRepairingCorrupted] = useState(false);
  const navigate = useNavigate();

  const handleCopyId = async (e: React.MouseEvent, swapId: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(swapId);
      setCopiedId(swapId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy swap ID:", error);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, swapId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSwapToDelete(swapId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!swapToDelete) return;

    try {
      await api.deleteSwap(swapToDelete);
      setSwaps((prevSwaps) =>
        prevSwaps.filter((s) => s.response.id !== swapToDelete),
      );
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
      await api.clearSwapStorage();
      setSwaps([]);
      setClearAllDialogOpen(false);
    } catch (error) {
      console.error("Failed to clear all swaps:", error);
    }
  };

  const handleDeleteCorruptedConfirm = async () => {
    setIsDeletingCorrupted(true);
    try {
      const deletedCount = await api.deleteCorruptedSwaps();
      console.log(`Deleted ${deletedCount} corrupted swap entries`);
      setCorruptedIds([]);
      setCorruptedDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete corrupted swaps:", error);
    } finally {
      setIsDeletingCorrupted(false);
    }
  };

  const handleRepairCorruptedConfirm = async () => {
    setIsRepairingCorrupted(true);
    try {
      const result = await api.repairCorruptedSwaps();
      console.log(
        `Repaired ${result.repaired} corrupted swap entries, ${result.failed.length} failed`,
      );

      if (result.repaired > 0) {
        // Reload swaps to show repaired entries
        const dexieSwaps = await api.listAllSwaps();
        setSwaps(dexieSwaps);
      }

      // Update corrupted IDs to only show failures
      setCorruptedIds(result.failed);

      if (result.failed.length === 0) {
        setCorruptedDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to repair corrupted swaps:", error);
    } finally {
      setIsRepairingCorrupted(false);
    }
  };

  useEffect(() => {
    const loadSwaps = async () => {
      try {
        const dexieSwaps = await api.listAllSwaps();
        setSwaps(dexieSwaps);

        // Check for corrupted entries that failed to deserialize
        const corrupted = api.getCorruptedSwapIds();
        if (corrupted.length > 0) {
          console.warn(
            `Found ${corrupted.length} corrupted swap entries:`,
            corrupted,
          );
          setCorruptedIds(corrupted);
        }
      } catch (error) {
        console.error("Failed to load swaps from Dexie:", error);
      }
    };

    loadSwaps();
  }, []);

  // Filter swaps based on search query
  const filteredSwaps = useMemo(() => {
    if (!searchQuery.trim()) return swaps;

    const query = searchQuery.toLowerCase().trim();

    return swaps.filter((swap) => {
      // Search by token symbols
      const sourceSymbol = getTokenSymbol(
        swap.response.source_token,
      ).toLowerCase();
      const targetSymbol = getTokenSymbol(
        swap.response.target_token,
      ).toLowerCase();
      if (sourceSymbol.includes(query) || targetSymbol.includes(query)) {
        return true;
      }

      // Search by asset amount (USD value)
      const asset_amount = swap.response.asset_amount.toFixed(2);
      if (asset_amount.includes(query) || `$${asset_amount}`.includes(query)) {
        return true;
      }

      // Search by sats amount
      const satsAmount = swap.response.sats_receive.toString();
      if (satsAmount.includes(query.replace(/,/g, ""))) {
        return true;
      }

      // Search by date (multiple formats)
      const swapDate = new Date(swap.response.created_at);
      const dateFormats = [
        format(swapDate, "dd-MMM-yyyy"), // 28-Nov-2025
        format(swapDate, "MMM"), // Nov
        format(swapDate, "MMMM"), // November
        format(swapDate, "yyyy"), // 2025
        format(swapDate, "dd"), // 28
        format(swapDate, "dd/MM/yyyy"), // 28/11/2025
        format(swapDate, "MM/dd/yyyy"), // 11/28/2025
      ];
      if (dateFormats.some((f) => f.toLowerCase().includes(query))) {
        return true;
      }

      // Search by status
      const statusInfo = getStatusInfo(swap.response.status);
      if (statusInfo.label.toLowerCase().includes(query)) {
        return true;
      }

      // Search by swap ID
      return swap.response.id.toLowerCase().includes(query);
    });
  }, [swaps, searchQuery]);

  // Format amounts for display - returns primary display string
  const formatSwapAmount = (swap: ExtendedSwapStorageData) => {
    const isBtcSource = swap.response.source_token.isBtc();

    if (isBtcSource) {
      return {
        primary: `${swap.response.sats_receive.toLocaleString()} sats`,
        secondary: `$${swap.response.asset_amount.toFixed(2)} ${getTokenSymbol(swap.response.target_token)}`,
      };
    } else {
      return {
        primary: `$${swap.response.asset_amount.toFixed(2)}`,
        secondary: `${swap.response.sats_receive.toLocaleString()} sats`,
      };
    }
  };

  const sortedFilteredSwaps = filteredSwaps.sort((a, b) => {
    return (
      parseISO(b.response.created_at).getTime() -
      parseISO(a.response.created_at).getTime()
    );
  });

  return (
    <>
      <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
        {/* Search Bar - only show when there are swaps */}
        {swaps.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search amount, currency, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 sm:pl-9 pr-8 sm:pr-9 h-9 sm:h-10 text-sm bg-muted/50 border-border/50 focus-visible:border-border"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Header with count and clear button */}
        {swaps.length > 0 && (
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {searchQuery ? (
                <>
                  {sortedFilteredSwaps.length} of {swaps.length} swap
                  {swaps.length !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  {swaps.length} swap{swaps.length !== 1 ? "s" : ""}
                </>
              )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllClick}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        )}

        {/* Warning banner for corrupted entries */}
        {corruptedIds.length > 0 && (
          <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                {corruptedIds.length} swap
                {corruptedIds.length !== 1 ? "s" : ""} could not be loaded due
                to data corruption.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCorruptedDialogOpen(true)}
              className="h-7 px-2 text-xs border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              Clean Up
            </Button>
          </div>
        )}

        {swaps.length === 0 ? (
          <div className="py-12 sm:py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted/50 mb-3 sm:mb-4">
              <Clock className="h-6 w-6 sm:h-7 sm:w-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground font-medium">
              No swaps yet
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground/60 mt-1">
              Your swap history will appear here
            </p>
          </div>
        ) : sortedFilteredSwaps.length === 0 ? (
          <div className="py-10 sm:py-12 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted/50 mb-2 sm:mb-3">
              <Search className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground font-medium">
              No matches found
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground/60 mt-1">
              Try a different amount, currency, or date
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 sm:space-y-2">
            {sortedFilteredSwaps.map((swap) => {
              const statusInfo = getStatusInfo(swap.response.status);
              const amounts = formatSwapAmount(swap);
              const timeAgo = formatDistanceToNow(
                new Date(swap.response.created_at),
                {
                  addSuffix: false,
                },
              );

              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={swap.response.id}
                  onClick={() => navigate(`/swap/${swap.response.id}/wizard`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/swap/${swap.response.id}/wizard`);
                    }
                  }}
                  className="group relative w-full text-left rounded-xl border border-border/40 bg-card hover:bg-accent/30 hover:border-border transition-all cursor-pointer overflow-hidden"
                >
                  <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 pr-1.5 sm:pr-2">
                    {/* Overlapping Token Icons */}
                    <div className="relative flex-shrink-0 w-10 h-7 sm:w-12 sm:h-8">
                      {/* Source token (front) */}
                      <div className="absolute left-0 top-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background border-2 border-background flex items-center justify-center overflow-hidden z-10 shadow-sm">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                          {getTokenIcon(swap.response.source_token)}
                        </div>
                      </div>
                      {/* Target token (behind) */}
                      <div className="absolute left-3.5 sm:left-4 top-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background border-2 border-background flex items-center justify-center overflow-hidden shadow-sm">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                          {getTokenIcon(swap.response.target_token)}
                        </div>
                      </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      {/* Primary: Amount */}
                      <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
                        <span className="font-semibold text-sm sm:text-base truncate">
                          {amounts.primary}
                        </span>
                        <span className="text-muted-foreground text-xs sm:text-sm truncate">
                          → {amounts.secondary}
                        </span>
                      </div>

                      {/* Secondary: Time and Status */}
                      <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5">
                        <span className="text-[10px] sm:text-xs text-muted-foreground/70">
                          {timeAgo} ago
                        </span>
                        <span className="text-muted-foreground/30">·</span>
                        <span
                          className={`text-[10px] sm:text-xs font-medium flex items-center gap-0.5 sm:gap-1 ${statusInfo.textColor}`}
                        >
                          {statusInfo.showIcon && statusInfo.icon}
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Right side: Actions + Chevron */}
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      {/* Dropdown Menu for actions - always visible on mobile */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 sm:p-1.5 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 hover:bg-muted transition-all"
                          >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={(e) => handleCopyId(e, swap.response.id)}
                            className="gap-2"
                          >
                            {copiedId === swap.response.id ? (
                              <>
                                <Check className="h-4 w-4 text-green-600" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy Swap ID
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) =>
                              handleDeleteClick(e, swap.response.id)
                            }
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Chevron */}
                      <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Version footer */}
        <div className="pt-6">
          <VersionFooter />
        </div>
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

      {/* Clean up corrupted swaps dialog */}
      <Dialog open={corruptedDialogOpen} onOpenChange={setCorruptedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repair Corrupted Entries</DialogTitle>
            <DialogDescription>
              {corruptedIds.length} swap{corruptedIds.length !== 1 ? "s" : ""}{" "}
              failed to load due to missing data. This can happen when the app
              was updated with incompatible data format changes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            <p className="mb-2">You can:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>
                <strong>Repair</strong> - fetch missing data from the server
                (recommended)
              </li>
              <li>
                <strong>Delete</strong> - permanently remove these entries
              </li>
            </ul>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setCorruptedDialogOpen(false)}
              disabled={isDeletingCorrupted || isRepairingCorrupted}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCorruptedConfirm}
              disabled={isDeletingCorrupted || isRepairingCorrupted}
            >
              {isDeletingCorrupted ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
            <Button
              variant="default"
              onClick={handleRepairCorruptedConfirm}
              disabled={isDeletingCorrupted || isRepairingCorrupted}
            >
              {isRepairingCorrupted ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Repairing...
                </>
              ) : (
                "Repair"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
