import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "#/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
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
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

interface AssetDropDownProps {
  value: TokenId;
  onChange: (selectedAsset: TokenId) => void;
  availableAssets: TokenId[];
}

export function AssetDropDown({
  value,
  onChange,
  availableAssets,
}: AssetDropDownProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedAsset = value;

  const setSelectedAsset = (asset: TokenId) => {
    onChange(asset);
    setDrawerOpen(false);
  };

  // Filter assets based on availableAssets if provided
  const filteredAssets = availableAssets;

  // Further filter by search query
  const searchFilteredAssets = filteredAssets.filter((asset) => {
    const query = searchQuery.toLowerCase();
    return asset.toLowerCase().includes(query);
  });

  // Compact trigger button for both mobile and desktop
  const TriggerButton = () => (
    <div className="flex items-center gap-1 px-1 py-0.5 md:px-1.5 md:py-1 rounded-md md:rounded-lg border border-border bg-background hover:bg-accent transition-colors">
      {/* Primary Icon - Asset */}
      <div className="flex items-center justify-center w-6 h-6 md:w-7 md:h-7 bg-muted rounded-full shrink-0 p-0.5">
        <div className="w-full h-full flex items-center justify-center">
          {getTokenIcon(selectedAsset)}
        </div>
      </div>

      {/* Text Content */}
      <div className="flex flex-col gap-0 min-w-0">
        <span className="font-bold text-[10px] md:text-xs leading-tight whitespace-nowrap">
          {getTokenSymbol(selectedAsset)}
        </span>
        <div className="flex items-center gap-0.5 px-0.5 py-0 bg-muted/50 rounded-sm w-fit">
          {typeof getTokenNetworkIcon(selectedAsset) === "string" ? (
            <span className="text-[7px] md:text-[8px]">
              {getTokenNetworkIcon(selectedAsset)}
            </span>
          ) : (
            <div className="w-1.5 h-1.5 md:w-2 md:h-2">
              {getTokenNetworkIcon(selectedAsset)}
            </div>
          )}
          <span className="text-[7px] md:text-[8px] font-medium text-muted-foreground leading-none whitespace-nowrap">
            {getTokenNetworkName(selectedAsset)}
          </span>
        </div>
      </div>

      {/* Dropdown Arrow */}
      <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3 text-muted-foreground shrink-0" />
    </div>
  );

  // Asset list item component (reused for both dropdown and drawer)
  const AssetListItem = ({
    asset,
    onClick,
  }: {
    asset: TokenId;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-xl hover:bg-accent transition-colors w-full text-left"
    >
      {/* Primary Icon - Asset */}
      <div className="flex items-center justify-center w-12 h-12 bg-muted rounded-full border border-border shrink-0 p-1 overflow-hidden">
        <div className="w-full h-full flex items-center justify-center scale-125">
          {getTokenIcon(asset)}
        </div>
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-sm">{getTokenSymbol(asset)}</span>
          <div className="flex items-center gap-0.5 px-1 py-0.5 bg-muted/50 rounded-md w-fit">
            {typeof getTokenNetworkIcon(asset) === "string" ? (
              <span className="text-[8px]">{getTokenNetworkIcon(asset)}</span>
            ) : (
              <div className="w-2 h-2">{getTokenNetworkIcon(asset)}</div>
            )}
            <span className="text-[8px] font-medium text-muted-foreground">
              {getTokenNetworkName(asset)}
            </span>
          </div>
        </div>
      </div>

      {/* Checkmark for selected item */}
      {selectedAsset === asset && (
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary shrink-0">
          <Check className="w-4 h-4 text-primary-foreground shrink-0" />
        </div>
      )}
    </button>
  );

  // Mobile view: Drawer
  if (isMobile) {
    return (
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger className="w-full" asChild>
          <button type="button" className="w-full">
            <TriggerButton />
          </button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="border-b">
            <DrawerTitle>Select Trading Pair</DrawerTitle>
            {/* Search Input */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search assets or networks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto max-h-[60vh] p-4 pb-8 space-y-1">
            {searchFilteredAssets.length > 0 ? (
              searchFilteredAssets.map((asset) => (
                <AssetListItem
                  key={asset}
                  asset={asset}
                  onClick={() => setSelectedAsset(asset)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No assets found
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop view: Dropdown Menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full" asChild>
        <button type="button" className="w-full">
          <TriggerButton />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[280px] p-2 rounded-xl max-h-[400px] overflow-y-auto"
        align="end"
      >
        <div className="space-y-1">
          {filteredAssets.map((asset) => (
            <AssetListItem
              key={asset}
              asset={asset}
              onClick={() => setSelectedAsset(asset)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
