import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "#/components/ui/drawer";
import { Input } from "#/components/ui/input";
import {
  getTokenIcon,
  getTokenNetworkName,
  getTokenSymbol,
  type TokenId,
} from "../api";
import { getTokenNetworkIcon } from "../utils/tokenUtils";

// Hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

interface AssetDropDownProps {
  value: TokenId;
  onChange: (selectedAsset: TokenId) => void;
  availableAssets: TokenId[];
  label?: "sell" | "buy";
}

export function AssetDropDown({
  value,
  onChange,
  availableAssets,
  label = "sell",
}: AssetDropDownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();

  const selectedAsset = value;

  const handleSelect = (asset: TokenId) => {
    onChange(asset);
    setOpen(false);
    setSearchQuery("");
  };

  // Filter assets by search query
  const filteredAssets = availableAssets.filter((asset) => {
    const query = searchQuery.toLowerCase();
    const symbol = getTokenSymbol(asset).toLowerCase();
    const network = getTokenNetworkName(asset).toLowerCase();
    return (
      asset.toLowerCase().includes(query) ||
      symbol.includes(query) ||
      network.includes(query)
    );
  });

  // Shared content for both Dialog and Drawer
  const tokenListContent = (
    <>
      {/* Search Input */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or network"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-muted border-0 focus-visible:ring-1"
            autoFocus={!isMobile}
          />
        </div>
      </div>

      {/* Token List */}
      <div className="overflow-y-auto max-h-[50vh] px-2 pb-4 scrollbar-thin">
        {filteredAssets.length > 0 ? (
          <div className="space-y-1">
            {filteredAssets.map((asset) => (
              <button
                key={asset}
                type="button"
                onClick={() => handleSelect(asset)}
                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted transition-colors text-left"
              >
                {/* Token Icon */}
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-muted border border-border">
                  <div className="w-8 h-8 flex items-center justify-center">
                    {getTokenIcon(asset)}
                  </div>
                </div>

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{getTokenSymbol(asset)}</div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {typeof getTokenNetworkIcon(asset) === "string" ? (
                      <span className="text-xs">
                        {getTokenNetworkIcon(asset)}
                      </span>
                    ) : (
                      <div className="w-3 h-3">
                        {getTokenNetworkIcon(asset)}
                      </div>
                    )}
                    <span>{getTokenNetworkName(asset)}</span>
                  </div>
                </div>

                {/* Selected Check */}
                {selectedAsset === asset && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No currencies found
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Trigger Button - Uniswap style */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-background shadow-sm hover:shadow-md transition-all"
      >
        <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
          {getTokenIcon(selectedAsset)}
        </div>
        <div className="flex flex-col items-start">
          <span className="font-semibold text-sm leading-tight">
            {getTokenSymbol(selectedAsset)}
          </span>
          <span className="text-xs text-muted-foreground leading-tight">
            {getTokenNetworkName(selectedAsset)}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Mobile: Bottom Sheet Drawer */}
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader className="pb-0">
              <DrawerTitle>
                {label === "buy"
                  ? "Select a currency to buy"
                  : "Select a currency to sell"}
              </DrawerTitle>
            </DrawerHeader>
            {tokenListContent}
          </DrawerContent>
        </Drawer>
      ) : (
        /* Desktop: Dialog Modal */
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>
                {label === "buy"
                  ? "Select a currency to buy"
                  : "Select a currency to sell"}
              </DialogTitle>
            </DialogHeader>
            {tokenListContent}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
