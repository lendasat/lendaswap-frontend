import {
  type Chain,
  isBtc,
  type TokenId,
  type TokenInfo,
  toChain,
} from "@lendasat/lendaswap-sdk-pure";
import { TokenBTC } from "@web3icons/react";
import { NetworkIcon, TokenIcon } from "@web3icons/react/dynamic";
import type { ReactElement } from "react";
import {
  arbitrum,
  mainnet,
  polygon,
  type Chain as ViemChain,
} from "viem/chains";
import { ReactComponent as Arbitrum } from "../../assets/arbitrum.svg";
import { ReactComponent as Polygon } from "../../assets/polygon.svg";
import { ReactComponent as Ethereum } from "../../assets/eth.svg";
import { ReactComponent as ArkadeIcon } from "../../assets/arkade.svg";
import { ReactComponent as BitcoinIcon } from "../../assets/bitcoin.svg";
import { ReactComponent as BitcoinLightningIcon } from "../../assets/bitcoin_lightning.svg";
import { ReactComponent as Usdc } from "../../assets/usdc.svg";
import { ReactComponent as Usdt } from "../../assets/usdt.svg";
import { ReactComponent as Usdt0 } from "../../assets/usdt0.svg";
import { ReactComponent as Wbtc } from "../../assets/wbtc.svg";
import { ReactComponent as Xaut } from "../../assets/xaut.svg";

/**
 * Get the full display name for a token (including network)
 */
export function getTokenDisplayName(tokenId: TokenInfo): string {
  return `${tokenId.symbol} (${tokenId.chain})`;
}

/**
 * Get the icon component for a token
 */
export function getTokenIcon(
  tokenId: TokenInfo,
  width?: number,
  height?: number,
): ReactElement {
  if (tokenId.token_id.toLowerCase() === "btc") {
    return <TokenBTC height={height} width={width} variant={"branded"} />;
  }

  if (tokenId.symbol.toLowerCase() === "wbtc") {
    return <Wbtc width={64} height={64} />;
  }
  if (tokenId.symbol.toLowerCase() === "usdc") {
    return <Usdc width={64} height={64} />;
  }
  if (tokenId.symbol.toLowerCase() === "usdt0") {
    return <Usdt0 width={64} height={64} />;
  }
  if (tokenId.symbol.toLowerCase() === "usdt") {
    return <Usdt width={64} height={64} />;
  }
  if (tokenId.symbol.toLowerCase() === "xaut") {
    return <Xaut width={64} height={64} />;
  }

  return (
    <TokenIcon
      symbol={tokenId.symbol.toLowerCase()}
      size={"4rem"}
      variant={"branded"}
    />
  );
}

/**
 * Get the icon component for a token's network
 */
export function getTokenNetworkIcon(tokenId: TokenInfo): ReactElement {
  if (tokenId.chain === "Lightning") {
    return <BitcoinLightningIcon width={8} height={8} />;
  }
  if (tokenId.chain === "Bitcoin") {
    return <BitcoinIcon width={8} height={8} />;
  }
  if (tokenId.chain === "Arkade") {
    return <ArkadeIcon width={8} height={8} />;
  }
  if (!tokenId.chain) {
    // Fallback for unknown tokens
    return <span>?</span>;
  }

  if (tokenId.chain === "1") {
    return <Ethereum width={8} height={8} />;
  }
  if (tokenId.chain === "137") {
    return <Polygon width={8} height={8} />;
  }
  if (tokenId.chain === "42161") {
    return <Arbitrum width={8} height={8} />;
  }

  return <NetworkIcon chainId={tokenId.chain} />;
}

/**
 * Get the network name for a token
 */
export function getTokenNetworkName(tokenId: TokenInfo): string {
  return tokenId.chain;
}

/**
 * Get viem chain from a chain name string (case-insensitive)
 */
export function getViemChain(chain?: string): ViemChain | undefined {
  if (!chain) {
    return undefined;
  }
  switch (chain.toLowerCase()) {
    case "polygon":
      return polygon;
    case "arbitrum":
      return arbitrum;
    case "ethereum":
      return mainnet;
    default:
      return undefined;
  }
}

/**
 * Get viem chain by numeric chain ID
 */
export function getViemChainById(chainId: number): ViemChain | undefined {
  switch (chainId) {
    case 137:
      return polygon;
    case 42161:
      return arbitrum;
    case 1:
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
} from "@lendasat/lendaswap-sdk-pure";

export function getBlockexplorerTxLink(
  chaub: Chain,
  txid?: string | null,
): string {
  if (!txid) {
    return "";
  }
  switch (chaub) {
    case "137":
      return `https://polygonscan.com/tx/${txid}`;
    case "42161":
      return `https://arbiscan.io/tx/${txid}`;
    case "1":
      return `https://etherscan.com/tx/${txid}`;
    case "Bitcoin":
      return `https://mempool.space/tx/${txid}`;
    case "Arkade":
      return `https://arkade.space/tx/${txid}`;
    case "Lightning":
      return `https://arkade.space/tx/${txid}`;
    default:
      return txid;
  }
}

export function getBlockexplorerAddressLink(
  chain: Chain,
  address?: string | null,
): string {
  if (!address) {
    return "";
  }
  switch (chain) {
    case "137":
      return `https://polygonscan.com/address/${address}`;
    case "42161":
      return `https://arbiscan.io/address/${address}`;
    case "1":
      return `https://etherscan.com/address/${address}`;
    case "Bitcoin":
      return `https://mempool.space/address/${address}`;
    case "Arkade":
      return `https://arkade.space/address/${address}`;
    case "Lightning":
      return `https://arkade.space/address/${address}`;
    default:
      return address;
  }
}

// ---------------------------------------------------------------------------
// URL token format: "chain:token_id" (e.g., "lightning:btc", "polygon:usdc_pol")
// ---------------------------------------------------------------------------

/** Parsed representation of a URL token string like "lightning:btc" or "polygon:usdc_pol". */
export interface UrlToken {
  /** Chain in canonical PascalCase (e.g., "Lightning", "Polygon"). */
  chain: Chain;
  /** SDK TokenId (e.g., "btc", "usdc_pol"). */
  tokenId: TokenId;
}

/**
 * Parse a URL token string like "lightning:btc" or "polygon:usdc_pol" into a {@link UrlToken}.
 *
 * Returns `undefined` if the string is not a valid URL token.
 */
export function parseUrlToken(raw: string): UrlToken | undefined {
  const idx = raw.indexOf(":");
  if (idx === -1) return undefined;

  const chainStr = raw.substring(0, idx).toLowerCase();
  const tokenId = raw.substring(idx + 1);
  const chain = toChain(chainStr);

  if (!tokenId) return undefined;

  return { chain, tokenId };
}

/**
 * Format a TokenInfo into URL token string format "chain:token_id".
 *
 * Examples: "lightning:btc", "polygon:usdc_pol", "ethereum:xaut_eth"
 *
 * Round-trips correctly with {@link parseUrlToken}.
 */
export function formatTokenUrl(token: TokenInfo): string {
  if (isBtc(token)) {
    return `${token.chain.toLowerCase()}:btc`;
  }
  return `${token.chain.toLowerCase()}:${token.token_id}`;
}
