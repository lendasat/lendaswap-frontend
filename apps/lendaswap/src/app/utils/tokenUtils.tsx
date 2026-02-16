import {
  BTC_ARKADE,
  BTC_LIGHTNING,
  BTC_ONCHAIN,
  type Chain,
  isBtc,
  toChain,
  tokenChain,
  type TokenId,
  type TokenInfo,
} from "@lendasat/lendaswap-sdk-pure";
import { NetworkIcon, TokenIcon } from "@web3icons/react/dynamic";
import type { ReactElement } from "react";
import {
  arbitrum,
  type Chain as ViemChain,
  mainnet,
  polygon,
} from "viem/chains";
import { ReactComponent as ArkadeIcon } from "../../assets/arkade.svg";
import { ReactComponent as BitcoinIcon } from "../../assets/bitcoin.svg";
import { ReactComponent as BitcoinLightningIcon } from "../../assets/bitcoin_lightning.svg";

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
  if (tokenId.chain === "Bitcoin") {
    return <TokenIcon symbol={"btc"} height={height} width={width} />;
  }

  if (!tokenId.chain) {
    console.log(`Unsupported token ${JSON.stringify(tokenId)}`);
  }

  console.log(`Token: ${JSON.stringify(tokenId)}`);

  return (
    <TokenIcon
      address={tokenId.token_id}
      network={tokenId.chain.toLowerCase()}
      width={width}
      height={height}
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

  return <NetworkIcon name={tokenId.chain.toString().toLowerCase()} />;
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

/**
 * Map TokenId → ERC-20 contract address + EVM chain ID.
 * Used to call the generic swap creation endpoints which require
 * tokenAddress and evmChainId instead of TokenId strings.
 */
export const EVM_TOKEN_MAP: Record<
  string,
  { tokenAddress: string; evmChainId: number }
> = {
  usdc_pol: {
    tokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    evmChainId: 137,
  },
  usdc_arb: {
    tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    evmChainId: 42161,
  },
  usdc_eth: {
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    evmChainId: 1,
  },
  usdt_pol: {
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    evmChainId: 137,
  },
  usdt_arb: {
    tokenAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    evmChainId: 42161,
  },
  usdt_eth: {
    tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    evmChainId: 1,
  },
  usdt0_pol: {
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    evmChainId: 137,
  },
  wbtc_pol: {
    tokenAddress: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
    evmChainId: 137,
  },
  wbtc_eth: {
    tokenAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    evmChainId: 1,
  },
  wbtc_arb: {
    tokenAddress: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    evmChainId: 42161,
  },
  xaut_eth: {
    tokenAddress: "0x68749665FF8D2d112Fa859AA293F07A622782F38",
    evmChainId: 1,
  },
};

/**
 * Look up ERC-20 contract address and chain ID for a given TokenId.
 * Returns undefined for non-EVM tokens (btc_*, pol_pol native).
 */
export function getEvmTokenInfo(
  tokenId: string,
): { tokenAddress: string; evmChainId: number } | undefined {
  return EVM_TOKEN_MAP[tokenId];
}

// Re-export token helpers from SDK
export {
  isArbitrumToken,
  isEthereumToken,
  isEvmToken,
  isPolygonToken,
  tokenChain,
} from "@lendasat/lendaswap-sdk-pure";

export function getBlockexplorerTxLink(
  chaub: Chain,
  txid?: string | null,
): string {
  if (!txid) {
    return "";
  }
  switch (chaub) {
    case "Polygon":
      return `https://polygonscan.com/tx/${txid}`;
    case "Arbitrum":
      return `https://arbiscan.io/tx/${txid}`;
    case "Ethereum":
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
    case "Polygon":
      return `https://polygonscan.com/address/${address}`;
    case "Arbitrum":
      return `https://arbiscan.io/address/${address}`;
    case "Ethereum":
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
// URL token format: "chain:address" (e.g., "lightning:btc", "polygon:0x3c49...")
// ---------------------------------------------------------------------------

/** Parsed representation of a URL token string like "lightning:btc" or "polygon:0x3c49...". */
export interface UrlToken {
  /** Chain in canonical PascalCase (e.g., "Lightning", "Polygon"). */
  chain: Chain;
  /** Resolved SDK TokenId (e.g., "btc_lightning", "0x3c49..._pol"). */
  tokenId: TokenId;
}

/**
 * Resolve an EVM contract address to a TokenId using the EVM_TOKEN_MAP.
 * Returns undefined if the address is not found.
 */
function resolveEvmTokenId(address: string): TokenId | undefined {
  const lower = address.toLowerCase();
  for (const [tokenId, info] of Object.entries(EVM_TOKEN_MAP)) {
    if (info.tokenAddress.toLowerCase() === lower) {
      return tokenId;
    }
  }
  return undefined;
}

/**
 * Parse a URL token string like "lightning:btc" or "polygon:0x3c49..." into a {@link UrlToken}.
 *
 * - BTC tokens use "btc" as address: "lightning:btc" → tokenId "btc_lightning"
 * - EVM tokens use contract addresses: "polygon:0x3c49..." → tokenId "usdc_pol"
 *
 * Returns `undefined` if the string is not a valid URL token.
 */
export function parseUrlToken(raw: string): UrlToken | undefined {
  const idx = raw.indexOf(":");
  if (idx === -1) return undefined;

  const chainStr = raw.substring(0, idx).toLowerCase();
  const address = raw.substring(idx + 1);
  const chain = toChain(chainStr);

  if (!address) return undefined;

  // BTC tokens: "btc" resolves to the chain-specific token_id
  if (address === "btc") {
    switch (chain) {
      case "Lightning":
        return { chain, tokenId: BTC_LIGHTNING };
      case "Arkade":
        return { chain, tokenId: BTC_ARKADE };
      case "Bitcoin":
        return { chain, tokenId: BTC_ONCHAIN };
    }
  }

  // EVM tokens: resolve contract address → short token_id
  const evmTokenId = resolveEvmTokenId(address);
  return { chain, tokenId: evmTokenId ?? address };
}

/**
 * Format a TokenInfo into URL token string format "chain:address".
 *
 * - BTC tokens: "lightning:btc", "arkade:btc", "bitcoin:btc"
 * - EVM tokens: "polygon:0x3c49...", "ethereum:0xA0b8..."
 *
 * Round-trips correctly with {@link parseUrlToken}.
 */
export function formatTokenUrl(token: TokenInfo): string {
  if (isBtc(token)) {
    return `${token.chain.toLowerCase()}:btc`;
  }
  const evmInfo = EVM_TOKEN_MAP[token.token_id];
  if (evmInfo) {
    return `${token.chain.toLowerCase()}:${evmInfo.tokenAddress}`;
  }
  return `${token.chain.toLowerCase()}:${token.token_id}`;
}

/**
 * Format a TokenId into URL token string format "chain:address".
 *
 * Round-trips correctly with {@link parseUrlToken}.
 */
export function formatUrlToken(tokenId: TokenId): string {
  if (tokenId === BTC_LIGHTNING) return "lightning:btc";
  if (tokenId === BTC_ARKADE) return "arkade:btc";
  if (tokenId === BTC_ONCHAIN) return "bitcoin:btc";

  const evmInfo = EVM_TOKEN_MAP[tokenId];
  const chain = tokenChain(tokenId).toLowerCase();
  if (evmInfo) {
    return `${chain}:${evmInfo.tokenAddress}`;
  }
  return `${chain}:${tokenId}`;
}
