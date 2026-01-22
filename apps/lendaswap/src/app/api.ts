// Re-export types from SDK - single source of truth
import {
  type AssetPair,
  type BtcToArkadeSwapRequest,
  type BtcToArkadeSwapResponse,
  type BtcToEvmSwapResponse,
  type Chain,
  type EvmToArkadeSwapRequest,
  type EvmToBtcSwapResponse,
  type EvmToLightningSwapRequest,
  type ExtendedSwapStorageData,
  type GetSwapResponse,
  getUsdPrices,
  type OnchainToEvmSwapRequest,
  type OnchainToEvmSwapResponse,
  type QuoteResponse,
  type RecoveredSwap,
  type RecoverSwapsResponse,
  Client as SdkClient,
  type SwapRequest,
  SwapStatus,
  type TokenIdString,
  type TokenInfo,
  type Version,
  type VhtlcAmounts,
} from "@lendasat/lendaswap-sdk";
import { getReferralCode } from "./utils/referralCode";

// Re-export SDK types for use throughout the frontend
export type {
  TokenIdString,
  Chain,
  TokenInfo,
  AssetPair,
  BtcToArkadeSwapRequest,
  BtcToArkadeSwapResponse,
  BtcToEvmSwapResponse,
  EvmToBtcSwapResponse,
  GetSwapResponse,
  SwapRequest,
  EvmToArkadeSwapRequest,
  EvmToLightningSwapRequest,
  OnchainToEvmSwapRequest,
  OnchainToEvmSwapResponse,
  RecoveredSwap,
  RecoverSwapsResponse,
  QuoteResponse,
  Version,
};
export { SwapStatus };

// Price feed types
export type {
  PriceTiers,
  PriceUpdateMessage,
  TradingPairPrices,
} from "@lendasat/lendaswap-sdk";

// Quote request type
export interface QuoteRequest {
  from: TokenIdString;
  to: TokenIdString;
  base_amount: number;
}

// Token utility functions
export {
  getTokenDisplayName,
  getTokenIcon,
  getTokenNetworkName,
  getTokenSymbol,
} from "./utils/tokenUtils";

// API client for Lendaswap backend
const API_BASE_URL =
  import.meta.env.VITE_LENDASWAP_API_URL || "http://localhost:3333";

const ARK_SERVER_URL =
  import.meta.env.VITE_ARKADE_URL || "https://arkade.computer";

const BITCOIN_NETWORK = import.meta.env.VITE_BITCOIN_NETWORK || "bitcoin";

const ESPLORA_URL =
  import.meta.env.VITE_ESPLORA_URL || "https://mempool.space/api";

// Lazy-initialized SDK API client
let sdkClient: SdkClient | null = null;

async function getSdkClient(): Promise<SdkClient> {
  if (!sdkClient) {
    sdkClient = await SdkClient.builder()
      .url(API_BASE_URL)
      .withIdbStorage()
      .network(BITCOIN_NETWORK)
      .arkadeUrl(ARK_SERVER_URL)
      .esploraUrl(ESPLORA_URL)
      .build();

    await sdkClient.init();

    if (!sdkClient) {
      throw Error("Failed setting up sdk client");
    }
  }
  return sdkClient;
}

export const api = {
  async loadMnemonic(mnemonic: string): Promise<void> {
    const client = await getSdkClient();
    await client.init(mnemonic);
  },

  async getAssetPairs(): Promise<AssetPair[]> {
    const client = await getSdkClient();
    return await client.getAssetPairs();
  },

  async getTokens(): Promise<TokenInfo[]> {
    const client = await getSdkClient();
    return await client.getTokens();
  },

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const client = await getSdkClient();
    return await client.getQuote(
      request.from,
      request.to,
      BigInt(request.base_amount),
    );
  },

  async createLightningToEvmSwap(
    request: SwapRequest,
    targetNetwork: "ethereum" | "polygon",
  ): Promise<BtcToEvmSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getSdkClient();
    return await client.createLightningToEvmSwap(
      {
        ...request,
        referral_code: referralCode || undefined,
      },
      targetNetwork,
    );
  },

  async createArkadeToEvmSwap(
    request: SwapRequest,
    targetNetwork: "ethereum" | "polygon",
  ): Promise<BtcToEvmSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getSdkClient();
    return await client.createArkadeToEvmSwap(
      {
        ...request,
        referral_code: referralCode || undefined,
      },
      targetNetwork,
    );
  },

  async getSwap(id: string): Promise<ExtendedSwapStorageData> {
    const client = await getSdkClient();
    const swapStorageData = await client.getSwap(id);
    if (!swapStorageData) {
      throw new Error("Swap not found");
    }
    return swapStorageData;
  },

  async listAllSwaps(): Promise<ExtendedSwapStorageData[]> {
    const client = await getSdkClient();
    return await client.listAllSwaps();
  },

  async claimGelato(id: string, secret?: string): Promise<void> {
    const client = await getSdkClient();
    await client.claimGelato(id, secret);
  },

  async amountsForSwap(id: string): Promise<VhtlcAmounts> {
    const client = await getSdkClient();
    return await client.amountsForSwap(id);
  },

  async claimVhtlc(id: string): Promise<void> {
    const client = await getSdkClient();
    await client.claimVhtlc(id);
  },

  async refundVhtlc(id: string, refundAddress: string): Promise<string> {
    const client = await getSdkClient();
    return await client.refundVhtlc(id, refundAddress);
  },

  async createEvmToArkadeSwap(
    request: EvmToArkadeSwapRequest,
    sourceNetwork: "ethereum" | "polygon",
  ): Promise<EvmToBtcSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getSdkClient();
    return await client.createEvmToArkadeSwap(
      {
        ...request,
        referral_code: referralCode || undefined,
      },
      sourceNetwork,
    );
  },

  async createEvmToLightningSwap(
    request: EvmToLightningSwapRequest,
    sourceNetwork: "ethereum" | "polygon",
  ): Promise<EvmToBtcSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getSdkClient();
    return await client.createEvmToLightningSwap(
      {
        ...request,
        referral_code: referralCode || undefined,
      },
      sourceNetwork,
    );
  },

  async createBitcoinToArkadeSwap(
    request: BtcToArkadeSwapRequest,
  ): Promise<BtcToArkadeSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getSdkClient();
    return await client.createBitcoinToArkadeSwap({
      ...request,
      referral_code: referralCode || undefined,
    });
  },

  async createOnchainToEvmSwap(
    request: OnchainToEvmSwapRequest,
    targetNetwork: "ethereum" | "polygon",
  ): Promise<OnchainToEvmSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getSdkClient();
    return await client.createOnchainToEvmSwap(
      {
        ...request,
        referral_code: referralCode || undefined,
      },
      targetNetwork,
    );
  },

  async claimBtcToArkadeVhtlc(swapId: string): Promise<string> {
    const client = await getSdkClient();
    return await client.claimBtcToArkadeVhtlc(swapId);
  },

  async refundOnchainHtlc(
    swapId: string,
    refundAddress: string,
  ): Promise<string> {
    const client = await getSdkClient();
    return await client.refundOnchainHtlc(swapId, refundAddress);
  },

  async getVersion(): Promise<Version> {
    const client = await getSdkClient();
    return await client.getVersion();
  },

  async recoverSwaps(): Promise<ExtendedSwapStorageData[]> {
    const client = await getSdkClient();
    return await client.recoverSwaps();
  },

  async getMnemonic(): Promise<string> {
    const client = await getSdkClient();
    return await client.getMnemonic();
  },

  async getUserIdXpub() {
    const client = await getSdkClient();
    return await client.getUserIdXpub();
  },

  async clearSwapStorage(): Promise<void> {
    const client = await getSdkClient();
    return await client.clearSwapStorage();
  },

  async deleteSwap(id: string): Promise<void> {
    const client = await getSdkClient();
    return await client.deleteSwap(id);
  },

  // TODO: remove concept of corrupted swaps
  getCorruptedSwapIds(): string[] {
    if (!sdkClient) {
      return [];
    }
    return [];
  },

  async deleteCorruptedSwaps(): Promise<number> {
    return 0;
  },

  async repairCorruptedSwaps(): Promise<{
    repaired: number;
    failed: string[];
  }> {
    return {
      repaired: 0,
      failed: [],
    };
  },

  async getStats(): Promise<VolumeStats> {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetch USD prices for all supported tokens from CoinGecko.
   * Returns a Map of tokenId -> USD price.
   */
  async getTokenUsdPrices(): Promise<Map<string, number>> {
    const tokenIds: TokenIdString[] = [
      "btc_lightning",
      "btc_arkade",
      "btc_onchain",
      "usdc_pol",
      "usdt0_pol",
      "usdc_eth",
      "usdt_eth",
      "xaut_eth",
      "wbtc_pol",
      "wbtc_eth",
    ];

    const results = await getUsdPrices(tokenIds);
    const priceMap = new Map<string, number>();
    for (const result of results) {
      if (result.usdPrice !== null) {
        priceMap.set(result.tokenId, result.usdPrice);
      }
    }
    return priceMap;
  },
};

export interface VolumeStats {
  total_volume_usd: number;
  volume_24h_usd: number;
  total_swaps: number;
  swaps_24h: number;
}

// PriceFeedService
export { PriceFeedService } from "@lendasat/lendaswap-sdk";
