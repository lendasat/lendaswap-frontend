import { ReactComponent as BitcoinIcon } from "../../assets/bitcoin.svg";
import { ReactComponent as BitcoinLightningIcon } from "../../assets/bitcoin_lightning.svg";
import { ReactComponent as TetherIcon } from "../../assets/tether.svg";
import { ReactComponent as UsdcIcon } from "../../assets/usdc.svg";
import type { TokenId } from "../api";

interface TokenIconProps {
  tokenId: TokenId;
  className?: string;
}

export function TokenIcon({ tokenId, className = "h-5 w-5" }: TokenIconProps) {
  switch (tokenId) {
    case "btc_arkade":
      return <BitcoinIcon className={className} />;
    case "btc_lightning":
      return <BitcoinLightningIcon className={className} />;
    case "usdc_pol":
      return <UsdcIcon className={className} />;
    case "usdt_pol":
      return <TetherIcon className={className} />;
  }
}
