import {
  isArkade,
  isBtc,
  isBtcOnchain,
  isEvmToken,
  type TokenId,
} from "@lendasat/lendaswap-sdk-pure";
import type { ReactElement } from "react";
import { arbitrum, type Chain, mainnet, polygon } from "viem/chains";
import { ReactComponent as ArbitrumIcon } from "../../assets/arbitrum.svg";
import { ReactComponent as ArkadeIcon } from "../../assets/arkade.svg";
import { ReactComponent as BitcoinIcon } from "../../assets/bitcoin.svg";
import { ReactComponent as BitcoinLightningIcon } from "../../assets/bitcoin_lightning.svg";
import { ReactComponent as EthereumIcon } from "../../assets/eth.svg";
import { ReactComponent as PolIcon } from "../../assets/pol.svg";
import { ReactComponent as PolygonIcon } from "../../assets/polygon.svg";
import { ReactComponent as UsdcIcon } from "../../assets/usdc.svg";
import { ReactComponent as UsdtIcon } from "../../assets/usdt.svg";
import { ReactComponent as Usdt0Icon } from "../../assets/usdt0.svg";
import { ReactComponent as WbtcIcon } from "../../assets/wbtc.svg";
import { ReactComponent as XautIcon } from "../../assets/xaut.svg";

export function toPairName(sourceToken: TokenId, targetToken: TokenId) {
  if (isEvmToken(sourceToken) && isBtc(targetToken)) {
    return `${sourceToken}-${targetToken}`;
  } else if (isBtc(sourceToken) && isEvmToken(targetToken)) {
    return `${sourceToken}-${targetToken}`;
  } else if (isBtcOnchain(sourceToken) && isArkade(targetToken)) {
    return `${sourceToken}-${targetToken}`;
  } else {
    throw Error("Unsupported token pair");
  }
}

/**
 * Get the display symbol for a token
 */
export function getTokenSymbol(tokenId: TokenId): string {
  switch (tokenId) {
    case "usdc_pol":
    case "usdc_eth":
    case "usdc_arb":
      return "USDC";
    case "usdt0_pol":
      return "USDT0";
    case "usdt_eth":
    case "usdt_arb":
      return "USDT";
    case "xaut_eth":
      return "XAUt";
    case "wbtc_pol":
    case "wbtc_eth":
    case "wbtc_arb":
      return "WBTC";
    case "btc_arkade":
    case "btc_lightning":
    case "btc_onchain":
      return "BTC";
    case "pol_pol":
      return "POL";
    default:
      return "UNKNOWN";
  }
}

/**
 * Get the full display name for a token (including network)
 */
export function getTokenDisplayName(tokenId: TokenId): string {
  switch (tokenId) {
    case "btc_arkade":
      return "BTC (Arkade)";
    case "btc_lightning":
      return "BTC (Lightning)";
    case "btc_onchain":
      return "BTC (On-chain)";
    case "usdc_eth":
      return "USDC (Ethereum)";
    case "usdc_pol":
      return "USDC (Polygon)";
    case "usdc_arb":
      return "USDC (Arbitrum)";
    case "usdt_eth":
      return "USDT (Ethereum)";
    case "usdt_arb":
      return "USDT (Arbitrum)";
    case "usdt0_pol":
      return "USDT (Polygon)";
    case "xaut_eth":
      return "XAUt (Ethereum)";
    case "wbtc_eth":
      return "WBTC (Ethereum)";
    case "wbtc_pol":
      return "WBTC (Polygon)";
    case "wbtc_arb":
      return "WBTC (Arbitrum)";
    case "pol_pol":
      return "POL (Polygon)";
    default:
      return "Unknown Token";
  }
}

/**
 * Get the icon component for a token
 */
export function getTokenIcon(
  tokenId: TokenId,
  width?: number,
  height?: number,
): ReactElement {
  switch (tokenId) {
    case "btc_lightning":
    case "btc_arkade":
    case "btc_onchain":
      return <BitcoinIcon width={width} height={height} />;
    case "usdc_pol":
    case "usdc_eth":
    case "usdc_arb":
      return <UsdcIcon width={width} height={height} />;
    case "usdt0_pol":
      return <Usdt0Icon width={width} height={height} />;
    case "usdt_eth":
    case "usdt_arb":
      return <UsdtIcon width={width} height={height} />;
    case "xaut_eth":
      return <XautIcon width={width} height={height} />;
    case "wbtc_arb":
    case "wbtc_pol":
    case "wbtc_eth":
      return <WbtcIcon width={width} height={height} />;
    case "pol_pol":
      return <PolIcon width={width} height={height} />;
    default:
      // Fallback for unknown tokens
      return <span>?</span>;
  }
}

/**
 * Get the icon component for a token's network
 */
export function getTokenNetworkIcon(tokenId: TokenId): ReactElement {
  switch (tokenId) {
    case "btc_lightning":
      return <BitcoinLightningIcon width={8} height={8} />;
    case "btc_arkade":
      return <ArkadeIcon width={8} height={8} />;
    case "btc_onchain":
      return <BitcoinIcon width={8} height={8} />;
    case "usdc_arb":
    case "usdt_arb":
    case "wbtc_arb":
      return <ArbitrumIcon />;
    case "usdc_pol":
    case "usdt0_pol":
    case "wbtc_pol":
    case "pol_pol":
      return <PolygonIcon />;
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
    case "wbtc_eth":
      return <EthereumIcon />;
    default:
      // Fallback for unknown tokens
      return <span>?</span>;
  }
}

/**
 * Get the network name for a token
 */
export function getTokenNetworkName(tokenId: TokenId): string {
  switch (tokenId) {
    case "btc_arkade":
      return "Arkade";
    case "btc_lightning":
      return "Lightning";
    case "btc_onchain":
      return "Onchain";
    case "usdc_pol":
    case "usdt0_pol":
    case "wbtc_pol":
    case "pol_pol":
      return "Polygon";
    case "usdc_arb":
    case "usdt_arb":
    case "wbtc_arb":
      return "Arbitrum";
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
    case "wbtc_eth":
      return "Ethereum";
    default:
      return "Unknown";
  }
}

/**
 * Get viem chain
 */
export function getViemChain(tokenId: TokenId): Chain | undefined {
  switch (tokenId) {
    case "usdc_pol":
    case "usdt0_pol":
    case "wbtc_pol":
    case "pol_pol":
      return polygon;
    case "usdc_arb":
    case "usdt_arb":
    case "wbtc_arb":
      return arbitrum;
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
    case "wbtc_eth":
      return mainnet;
    default:
      return undefined;
  }
}

// Re-export token helpers from SDK
export {
  isArbitrumToken,
  isEthereumToken,
  isEvmToken,
  isPolygonToken,
  networkName,
} from "@lendasat/lendaswap-sdk-pure";

// Validate that the URL tokens are valid
export function isValidTokenId(token: string | undefined): boolean {
  return (
    token === "btc_lightning" ||
    token === "btc_arkade" ||
    token === "btc_onchain" ||
    token === "usdc_pol" ||
    token === "usdt0_pol" ||
    token === "wbtc_pol" ||
    token === "pol_pol" ||
    token === "usdt_eth" ||
    token === "usdc_eth" ||
    token === "xaut_eth" ||
    token === "wbtc_eth" ||
    token === "usdt_arb" ||
    token === "usdc_arb" ||
    token === "wbtc_arb"
  );
}

export function getBlockexplorerTxLink(
  tokenId: TokenId,
  txid?: string | null,
): string {
  if (!txid) {
    return "";
  }
  switch (tokenId) {
    case "usdc_pol":
    case "usdt0_pol":
    case "wbtc_pol":
    case "pol_pol":
      return `https://polygonscan.com/tx/${txid}`;
    case "usdc_arb":
    case "usdt_arb":
    case "wbtc_arb":
      return `https://arbiscan.io/tx/${txid}`;
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
    case "wbtc_eth":
      return `https://etherscan.com/tx/${txid}`;
    case "btc_onchain":
      return `https://mempool.space/tx/${txid}`;
    case "btc_arkade":
      return `https://arkade.space/tx/${txid}`;
    case "btc_lightning":
      return `https://arkade.space/tx/${txid}`;
    default:
      return txid;
  }
}

export function getBlockexplorerAddressLink(
  tokenId: TokenId,
  address?: string | null,
): string {
  if (!address) {
    return "";
  }
  switch (tokenId) {
    case "usdc_pol":
    case "usdt0_pol":
    case "wbtc_pol":
    case "pol_pol":
      return `https://polygonscan.com/address/${address}`;
    case "usdc_arb":
    case "usdt_arb":
    case "wbtc_arb":
      return `https://arbiscan.io/address/${address}`;
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
    case "wbtc_eth":
      return `https://etherscan.com/address/${address}`;
    case "btc_onchain":
      return `https://mempool.space/address/${address}`;
    case "btc_arkade":
      return `https://arkade.space/address/${address}`;
    case "btc_lightning":
      return `https://arkade.space/address/${address}`;
    default:
      return address;
  }
}
