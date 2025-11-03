import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import type { TokenId } from "../api";
import { ReactComponent as BitcoinIcon } from "../../assets/bitcoin.svg";
import { ReactComponent as LightningIcon } from "../../assets/bitcoin_lightning.svg";
import { ReactComponent as UsdcIcon } from "../../assets/usdc.svg";
import { ReactComponent as TetherIcon } from "../../assets/usdt0.svg";

// Token display configuration
interface TokenDisplay {
  symbol: string;
  network: string;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const TOKEN_CONFIG: Record<TokenId, TokenDisplay> = {
  btc_lightning: {
    symbol: "BTC",
    network: "Lightning",
    name: "Bitcoin Lightning",
    icon: LightningIcon,
  },
  btc_arkade: {
    symbol: "BTC",
    network: "Arkade",
    name: "Bitcoin Arkade",
    icon: BitcoinIcon,
  },
  usdc_pol: {
    symbol: "USDC",
    network: "Polygon",
    name: "USD Coin",
    icon: UsdcIcon,
  },
  usdt_pol: {
    symbol: "USDT0",
    network: "Polygon",
    name: "Tether USD",
    icon: TetherIcon,
  },
};

export default function AssetNetworkDropdown() {
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="w-full max-w-md">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-blue-200 rounded-2xl hover:border-blue-300 transition-colors shadow-sm">
              {/* Primary Icon - Asset */}
              <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full shrink-0 border-2 border-blue-100">
                <div className="w-7 h-7">{selectedAsset.icon}</div>
              </div>

              {/* Text Content */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-slate-900">
                    {selectedAsset.symbol}
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-full">
                    {typeof selectedAsset.network.icon === "string" ? (
                      <span className="text-xs">
                        {selectedAsset.network.icon}
                      </span>
                    ) : (
                      <div className="w-3 h-3">
                        {selectedAsset.network.icon}
                      </div>
                    )}
                    <span className="text-xs font-medium text-slate-700">
                      {selectedAsset.network.symbol}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dropdown Arrow */}
              <ChevronDown className="w-5 h-5 text-blue-600 shrink-0" />
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] p-2"
            align="start"
          >
            {ASSETS.map((asset) => (
              <DropdownMenuItem
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className="flex items-center gap-3 px-3 py-3 cursor-pointer rounded-lg hover:bg-slate-100 focus:bg-slate-100"
              >
                {/* Primary Icon - Asset */}
                <div className="flex items-center justify-center w-9 h-9 bg-white rounded-full border-2 border-slate-100 shrink-0">
                  <div className="w-6 h-6">{asset.icon}</div>
                </div>

                {/* Text Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {asset.symbol}
                    </span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-full">
                      {typeof asset.network.icon === "string" ? (
                        <span className="text-xs">{asset.network.icon}</span>
                      ) : (
                        <div className="w-3 h-3">{asset.network.icon}</div>
                      )}
                      <span className="text-xs font-medium text-slate-600">
                        {asset.network.symbol}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {asset.name}
                  </div>
                </div>

                {/* Checkmark for selected item */}
                {selectedAsset.id === asset.id && (
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Demo Info */}
        <div className="mt-6 p-4 bg-white rounded-lg border border-slate-200">
          <h3 className="font-semibold text-sm text-slate-900 mb-2">
            Selected Asset:
          </h3>
          <p className="text-sm text-slate-600">
            {selectedAsset.symbol} on {selectedAsset.network.name}
          </p>
        </div>
      </div>
    </div>
  );
}
