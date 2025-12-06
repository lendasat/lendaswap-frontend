import type { ReactElement } from "react";
import { type Chain, mainnet, polygon } from "viem/chains";
import { ReactComponent as ArkadeIcon } from "../../assets/arkade.svg";
import { ReactComponent as BitcoinIcon } from "../../assets/bitcoin.svg";
import { ReactComponent as BitcoinLightningIcon } from "../../assets/bitcoin_lightning.svg";
import { ReactComponent as EthereumIcon } from "../../assets/eth.svg";
import { ReactComponent as PolygonIcon } from "../../assets/polygon.svg";
import { ReactComponent as UsdcIcon } from "../../assets/usdc.svg";
import { ReactComponent as UsdtIcon } from "../../assets/usdt.svg";
import { ReactComponent as Usdt0Icon } from "../../assets/usdt0.svg";
import { ReactComponent as XautIcon } from "../../assets/xaut.svg";
import type { TokenId } from "../api";

export function toPairName(sourceToken: TokenId, targetToken: TokenId) {
  const isSourceEvm = isEvmToken(sourceToken);
  const isTargetEvm = isEvmToken(targetToken);
  const isSourceBtc = isBtcToken(sourceToken);
  const isTargetBtc = isBtcToken(targetToken);

  if (isSourceEvm && isTargetBtc) {
    return `${sourceToken}-btc`;
  } else if (isSourceBtc && isTargetEvm) {
    return `btc-${targetToken}`;
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
      return "USDC";
    case "usdt0_pol":
      return "USDT0";
    case "usdt_eth":
      return "USDT";
    case "xaut_eth":
      return "XAUt";
    case "btc_arkade":
    case "btc_lightning":
      return "BTC";
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
    case "usdc_eth":
      return "USDC (Ethereum)";
    case "usdc_pol":
      return "USDC (Polygon)";
    case "usdt_eth":
      return "USDT (Ethereum)";
    case "usdt0_pol":
      return "USDT (Polygon)";
    case "xaut_eth":
      return "XAUt (Ethereum)";
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
      return <BitcoinIcon width={width} height={height} />;
    case "btc_arkade":
      return <BitcoinIcon width={width} height={height} />;
    case "usdc_pol":
    case "usdc_eth":
      return <UsdcIcon width={width} height={height} />;
    case "usdt0_pol":
      return <Usdt0Icon width={width} height={height} />;
    case "usdt_eth":
      return <UsdtIcon width={width} height={height} />;
    case "xaut_eth":
      return <XautIcon width={width} height={height} />;
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
    case "usdc_pol":
    case "usdt0_pol":
      return <PolygonIcon />;
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
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
    case "usdc_pol":
    case "usdt0_pol":
      return "Polygon";
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
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
      return polygon;
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
      return mainnet;
    default:
      return undefined;
  }
}

/**
 * Check if a token is from an EVM chain
 */
export function isEvmToken(tokenId: TokenId): boolean {
  switch (tokenId) {
    case "usdc_pol":
    case "usdt0_pol":
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
      return true;
    case "btc_arkade":
    case "btc_lightning":
      return false;
  }
}

/**
 * Check if a token is from Ethereum
 */
export function isEthereumToken(tokenId: TokenId): boolean {
  switch (tokenId) {
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
      return true;
    default:
      return false;
  }
}

/**
 * Check if a token is from Polygon
 */
export function isPolygonToken(tokenId: TokenId): boolean {
  switch (tokenId) {
    case "usdc_pol":
    case "usdt0_pol":
      return true;
    default:
      return false;
  }
}

/**
 * Get the network name for a token, to be used as part of a URL
 */
export function networkName(
  tokenId: TokenId,
): "ethereum" | "lightning" | "polygon" | "arkade" {
  switch (tokenId) {
    case "usdc_pol":
    case "usdt0_pol":
      return "polygon";
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
      return "ethereum";
    case "btc_arkade":
      return "arkade";
    case "btc_lightning":
      return "lightning";
  }
}

// Validate that the URL tokens are valid
export function isValidTokenId(token: string | undefined): token is TokenId {
  return (
    token === "btc_lightning" ||
    token === "btc_arkade" ||
    token === "usdc_pol" ||
    token === "usdt0_pol" ||
    token === "usdt_eth" ||
    token === "usdc_eth" ||
    token === "xaut_eth"
  );
}

// Validate if this is a usd token or not (XAUT is gold, not USD)
export function isUsdToken(tokenId: TokenId): boolean {
  switch (tokenId) {
    case "usdc_pol":
    case "usdt0_pol":
    case "usdc_eth":
    case "usdt_eth":
      return true;
    case "btc_arkade":
    case "btc_lightning":
    case "xaut_eth":
      return false;
  }
}

// Check if this is a non-USD EVM token (like XAUT/gold)
export function isNonUsdEvmToken(tokenId: TokenId): boolean {
  switch (tokenId) {
    case "xaut_eth":
      return true;
    default:
      return false;
  }
}

// Validate if this is a btc token or not
export function isBtcToken(tokenId: TokenId): boolean {
  switch (tokenId) {
    case "usdc_pol":
    case "usdt0_pol":
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
      return false;
    case "btc_arkade":
    case "btc_lightning":
      return true;
  }
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
      return `https://polygonscan.com/tx/${txid}`;
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
      return `https://etherscan.com/tx/${txid}`;
    case "btc_arkade":
    case "btc_lightning":
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
      return `https://polygonscan.com/address/${address}`;
    case "usdc_eth":
    case "usdt_eth":
    case "xaut_eth":
      return `https://etherscan.com/address/${address}`;
    case "btc_arkade":
    case "btc_lightning":
      return address;
  }
}
