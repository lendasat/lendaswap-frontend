import {
  isArkade,
  isBtc,
  isBtcOnchain,
  isEvmToken,
  type TokenInfo,
  type TokenId,
} from "@lendasat/lendaswap-sdk-pure";
import { NetworkIcon, TokenIcon } from "@web3icons/react/dynamic";
import type { ReactElement } from "react";
import { arbitrum, type Chain, mainnet, polygon } from "viem/chains";
import { ReactComponent as ArkadeIcon } from "../../assets/arkade.svg";
import { ReactComponent as BitcoinIcon } from "../../assets/bitcoin.svg";
import { ReactComponent as BitcoinLightningIcon } from "../../assets/bitcoin_lightning.svg";

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
export function getTokenSymbol(tokenId: TokenInfo): string {
  return tokenId.symbol;
}

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
 * Get viem chain
 */
export function getViemChain(tokenId: TokenInfo): Chain | undefined {
  switch (tokenId.chain) {
    case "Polygon":
      return polygon;
    case "Arbitrum":
      return arbitrum;
    case "Ethereum":
      return mainnet;
    default:
      return undefined;
  }
}

/**
 * Get viem chain by numeric chain ID
 */
export function getViemChainById(chainId: number): Chain | undefined {
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
  networkName,
} from "@lendasat/lendaswap-sdk-pure";

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
