import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "#/components/ui/drawer";
import { Input } from "#/components/ui/input";
import { TokenId } from "../api";

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

// Inline SVG Components
const USDCIcon = () => (
  <svg
    data-name="86977684-12db-4850-8f30-233a7c267d11"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 2000 2000"
    width="100%"
    height="100%"
    role="img"
    aria-label="USDC"
  >
    <path
      d="M1000 2000c554.17 0 1000-445.83 1000-1000S1554.17 0 1000 0 0 445.83 0 1000s445.83 1000 1000 1000z"
      fill="#2775ca"
    />
    <path
      d="M1275 1158.33c0-145.83-87.5-195.83-262.5-216.66-125-16.67-150-50-150-108.34s41.67-95.83 125-95.83c75 0 116.67 25 137.5 87.5 4.17 12.5 16.67 20.83 29.17 20.83h66.66c16.67 0 29.17-12.5 29.17-29.16v-4.17c-16.67-91.67-91.67-162.5-187.5-170.83v-100c0-16.67-12.5-29.17-33.33-33.34h-62.5c-16.67 0-29.17 12.5-33.34 33.34v95.83c-125 16.67-204.16 100-204.16 204.17 0 137.5 83.33 191.66 258.33 212.5 116.67 20.83 154.17 45.83 154.17 112.5s-58.34 112.5-137.5 112.5c-108.34 0-145.84-45.84-158.34-108.34-4.16-16.66-16.66-25-29.16-25h-70.84c-16.66 0-29.16 12.5-29.16 29.17v4.17c16.66 104.16 83.33 179.16 220.83 200v100c0 16.66 12.5 29.16 33.33 33.33h62.5c16.67 0 29.17-12.5 33.34-33.33v-100c125-20.84 208.33-108.34 208.33-220.84z"
      fill="#fff"
    />
    <path
      d="M787.5 1595.83c-325-116.66-491.67-479.16-370.83-800 62.5-175 200-308.33 370.83-370.83 16.67-8.33 25-20.83 25-41.67V325c0-16.67-8.33-29.17-25-33.33-4.17 0-12.5 0-16.67 4.16-395.83 125-612.5 545.84-487.5 941.67 75 233.33 254.17 412.5 487.5 487.5 16.67 8.33 33.34 0 37.5-16.67 4.17-4.16 4.17-8.33 4.17-16.66v-58.34c0-12.5-12.5-29.16-25-37.5zM1229.17 295.83c-16.67-8.33-33.34 0-37.5 16.67-4.17 4.17-4.17 8.33-4.17 16.67v58.33c0 16.67 12.5 33.33 25 41.67 325 116.66 491.67 479.16 370.83 800-62.5 175-200 308.33-370.83 370.83-16.67 8.33-25 20.83-25 41.67V1700c0 16.67 8.33 29.17 25 33.33 4.17 0 12.5 0 16.67-4.16 395.83-125 612.5-545.84 487.5-941.67-75-237.5-258.34-416.67-487.5-491.67z"
      fill="#fff"
    />
  </svg>
);

const USDTIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 976 976"
    width="100%"
    height="100%"
    fill="none"
    role="img"
    aria-label="USDT"
  >
    <circle cx="488" cy="488.3" r="488" fill="#00b988" />
    <path
      fill="#fff"
      d="M238.5 233.3h499v110.9h-194V455h-111V344h-194zM432.6 455V677h-111V455zM543.5 676.9h110.9V455h-111zH432.7v110.9h110.9z"
    />
  </svg>
);

const BitcoinIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="100%"
    width="100%"
    version="1.1"
    viewBox="0 0 64 64"
    role="img"
    aria-label="Bitcoin"
  >
    <g transform="translate(0.00630876,-0.00301984)">
      <path
        fill="#f7931a"
        d="m63.033,39.744c-4.274,17.143-21.637,27.576-38.782,23.301-17.138-4.274-27.571-21.638-23.295-38.78,4.272-17.145,21.635-27.579,38.775-23.305,17.144,4.274,27.576,21.64,23.302,38.784z"
      />
      <path
        fill="#FFF"
        d="m46.103,27.444c0.637-4.258-2.605-6.547-7.038-8.074l1.438-5.768-3.511-0.875-1.4,5.616c-0.923-0.23-1.871-0.447-2.813-0.662l1.41-5.653-3.509-0.875-1.439,5.766c-0.764-0.174-1.514-0.346-2.242-0.527l0.004-0.018-4.842-1.209-0.934,3.75s2.605,0.597,2.55,0.634c1.422,0.355,1.679,1.296,1.636,2.042l-1.638,6.571c0.098,0.025,0.225,0.061,0.365,0.117-0.117-0.029-0.242-0.061-0.371-0.092l-2.296,9.205c-0.174,0.432-0.615,1.08-1.609,0.834,0.035,0.051-2.552-0.637-2.552-0.637l-1.743,4.019,4.569,1.139c0.85,0.213,1.683,0.436,2.503,0.646l-1.453,5.834,3.507,0.875,1.439-5.772c0.958,0.26,1.888,0.5,2.798,0.726l-1.434,5.745,3.511,0.875,1.453-5.823c5.987,1.133,10.489,0.676,12.384-4.739,1.527-4.36-0.076-6.875-3.226-8.515,2.294-0.529,4.022-2.038,4.483-5.155zm-8.022,11.249c-1.085,4.36-8.426,2.003-10.806,1.412l1.928-7.729c2.38,0.594,10.012,1.77,8.878,6.317zm1.086-11.312c-0.99,3.966-7.1,1.951-9.082,1.457l1.748-7.01c1.982,0.494,8.365,1.416,7.334,5.553z"
      />
    </g>
  </svg>
);

const BitcoinLightningIcon = () => (
  <svg
    viewBox="0 0 280 280"
    style={{ background: "transparent" }}
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    role="img"
    aria-label="Bitcoin Lightning"
  >
    <path
      d="M 7 140.5 C 7 66.769 66.769 7 140.5 7 C 214.231 7 274 66.769 274 140.5 C 274 214.231 214.231 274 140.5 274 C 66.769 274 7 214.231 7 140.5 Z"
      fill="#f7931a"
    />
    <path
      d="M 161.1943 51.5 C 153.2349 72.1607 145.2756 94.4107 135.7244 116.6607 C 135.7244 116.6607 135.7244 119.8393 138.9081 119.8393 L 204.1747 119.8393 C 204.1747 119.8393 204.1747 121.4286 205.7667 123.0179 L 110.2545 229.5 C 108.6626 227.9107 108.6626 226.3214 108.6626 224.7321 L 142.0919 153.2143 L 142.0919 146.8571 L 75.2333 146.8571 L 75.2333 140.5 L 156.4187 51.5 L 161.1943 51.5 Z"
      fill="#ffffff"
    />
  </svg>
);

const PolygonIcon = () => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 360 360"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Polygon"
  >
    <rect width="360" height="360" rx="180" fill="#6C00F6" />
    <path
      d="M218.804 99.5819L168.572 128.432V218.473L140.856 234.539L112.97 218.46V186.313L140.856 170.39L158.786 180.788V154.779L140.699 144.511L90.4795 173.687V231.399L140.869 260.418L191.088 231.399V141.371L218.974 125.291L246.846 141.371V173.374L218.974 189.597L200.887 179.107V204.986L218.804 215.319L269.519 186.47V128.432L218.804 99.5819Z"
      fill="white"
    />
  </svg>
);

// Mock data for assets and networks
const ASSETS = [
  {
    id: "usdc_pol",
    symbol: "USDC",
    name: "USD Coin",
    icon: <USDCIcon />,
    network: {
      name: "Polygon",
      symbol: "Polygon",
      icon: <PolygonIcon />,
    },
  },
  {
    id: "usdt_pol",
    symbol: "USDT0",
    name: "Tether",
    icon: <USDTIcon />,
    network: {
      name: "Polygon",
      symbol: "Polygon",
      icon: <PolygonIcon />,
    },
  },
  {
    id: "btc_lightning",
    symbol: "BTC",
    name: "Bitcoin",
    icon: <BitcoinIcon />,
    network: {
      name: "Lightning",
      symbol: "Lightning",
      icon: <BitcoinLightningIcon />,
    },
  },
  {
    id: "btc_arkade",
    symbol: "BTC",
    name: "Bitcoin",
    icon: <BitcoinIcon />,
    network: {
      name: "Arkade",
      symbol: "Arkade",
      icon: "👾",
    },
  },
];

interface AssetDropDownProps {
  value: TokenId;
  onChange: (selectedAsset: TokenId) => void;
  availableAssets?: TokenId[];
}

export function AssetDropDown({
  value,
  onChange,
  availableAssets,
}: AssetDropDownProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  let selectedAsset = ASSETS[0];
  switch (value) {
    case "usdc_pol":
      selectedAsset = ASSETS[0];
      break;
    case "usdt_pol":
      selectedAsset = ASSETS[1];
      break;
    case "btc_lightning":
      selectedAsset = ASSETS[2];
      break;
    case "btc_arkade":
      selectedAsset = ASSETS[3];
      break;
  }

  const setSelectedAsset = (asset: TokenId) => {
    onChange(asset);
    setDrawerOpen(false);
  };

  // Filter assets based on availableAssets if provided
  const filteredAssets = availableAssets
    ? ASSETS.filter((asset) => availableAssets.includes(asset.id as TokenId))
    : ASSETS;

  // Further filter by search query
  const searchFilteredAssets = filteredAssets.filter((asset) => {
    const query = searchQuery.toLowerCase();
    return (
      asset.symbol.toLowerCase().includes(query) ||
      asset.name.toLowerCase().includes(query) ||
      asset.network.name.toLowerCase().includes(query)
    );
  });

  // Compact trigger button for both mobile and desktop
  const TriggerButton = () => (
    <div className="flex items-center gap-1 px-1 py-0.5 md:px-1.5 md:py-1 rounded-md md:rounded-lg border border-border bg-background hover:bg-accent transition-colors">
      {/* Primary Icon - Asset */}
      <div className="flex items-center justify-center w-6 h-6 md:w-7 md:h-7 bg-muted rounded-full shrink-0 p-0.5">
        <div className="w-full h-full flex items-center justify-center">
          {selectedAsset.icon}
        </div>
      </div>

      {/* Text Content */}
      <div className="flex flex-col gap-0 min-w-0">
        <span className="font-bold text-[10px] md:text-xs leading-tight whitespace-nowrap">
          {selectedAsset.symbol}
        </span>
        <div className="flex items-center gap-0.5 px-0.5 py-0 bg-muted/50 rounded-sm w-fit">
          {typeof selectedAsset.network.icon === "string" ? (
            <span className="text-[7px] md:text-[8px]">
              {selectedAsset.network.icon}
            </span>
          ) : (
            <div className="w-1.5 h-1.5 md:w-2 md:h-2">
              {selectedAsset.network.icon}
            </div>
          )}
          <span className="text-[7px] md:text-[8px] font-medium text-muted-foreground leading-none whitespace-nowrap">
            {selectedAsset.network.symbol}
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
    asset: (typeof ASSETS)[0];
    onClick: () => void;
  }) => (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-xl hover:bg-accent transition-colors"
    >
      {/* Primary Icon - Asset */}
      <div className="flex items-center justify-center w-12 h-12 bg-muted rounded-full border border-border shrink-0 p-1 overflow-hidden">
        <div className="w-full h-full flex items-center justify-center scale-125">
          {asset.icon}
        </div>
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-sm">{asset.symbol}</span>
          <div className="flex items-center gap-0.5 px-1 py-0.5 bg-muted/50 rounded-md w-fit">
            {typeof asset.network.icon === "string" ? (
              <span className="text-[8px]">{asset.network.icon}</span>
            ) : (
              <div className="w-2 h-2">{asset.network.icon}</div>
            )}
            <span className="text-[8px] font-medium text-muted-foreground">
              {asset.network.symbol}
            </span>
          </div>
        </div>
      </div>

      {/* Checkmark for selected item */}
      {selectedAsset.id === asset.id && (
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary shrink-0">
          <Check className="w-4 h-4 text-primary-foreground shrink-0" />
        </div>
      )}
    </div>
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
                  key={asset.id}
                  asset={asset}
                  onClick={() => setSelectedAsset(asset.id as TokenId)}
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
              key={asset.id}
              asset={asset}
              onClick={() => setSelectedAsset(asset.id as TokenId)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
