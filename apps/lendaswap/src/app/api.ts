// Re-export types from SDK - single source of truth
import {
  type AssetPair,
  type BtcToEvmSwapResponse,
  type Chain,
  createDexieSwapStorage,
  createDexieVtxoSwapStorage,
  createDexieWalletStorage,
  type EvmToArkadeSwapRequest,
  type EvmToBtcSwapResponse,
  type EvmToLightningSwapRequest,
  type ExtendedSwapStorageData,
  type GetSwapResponse,
  getUsdPrices,
  type QuoteResponseInfo,
  type RecoveredSwap,
  type RecoverSwapsResponse,
  Client as SdkClient,
  STORAGE_KEYS,
  type SwapCommonFields,
  type SwapRequest,
  type SwapStatus,
  type TokenIdString,
  type TokenInfo,
  type VersionInfo,
  type VhtlcAmounts,
} from "@lendasat/lendaswap-sdk";
import { getReferralCode } from "./utils/referralCode";

// Re-export SDK types for use throughout the frontend
export type {
  TokenIdString as TokenId,
  Chain,
  TokenInfo,
  AssetPair,
  SwapStatus,
  SwapCommonFields,
  BtcToEvmSwapResponse,
  EvmToBtcSwapResponse,
  GetSwapResponse,
  SwapRequest,
  EvmToArkadeSwapRequest,
  EvmToLightningSwapRequest,
  RecoveredSwap,
  RecoverSwapsResponse,
};

// Re-export with frontend-friendly names
export type QuoteResponse = QuoteResponseInfo;
export type Version = VersionInfo;

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

// Lazy-initialized SDK API client
let sdkClient: SdkClient | null = null;

async function getSdkClient(): Promise<SdkClient> {
  if (!sdkClient) {
    const walletStorage = createDexieWalletStorage("lendaswap-wallet-v1");
    const swapStorage = createDexieSwapStorage("lendaswap-v1");
    const vtxoSwapStorage = createDexieVtxoSwapStorage(
      "lendaswap-vtxo-swaps-v1",
    );
    sdkClient = await SdkClient.create(
      API_BASE_URL,
      walletStorage,
      swapStorage,
      vtxoSwapStorage,
      // TODO: this should be dynamic
      "bitcoin",
      ARK_SERVER_URL,
    );
    if (!sdkClient) {
      throw Error("Failed setting up sdk client");
    }

    const old_mnemonic =
      localStorage.getItem(STORAGE_KEYS.MNEMONIC) ?? undefined;

    await sdkClient.init(old_mnemonic);

    if (old_mnemonic) {
      console.info("Recovering from old mnemonic");
      await sdkClient
        .recoverSwaps()
        .catch((e) =>
          console.error(`Failed recovering swaps ${JSON.stringify(e)}`),
        );
      localStorage.setItem("old_lendaswap_hd_mnemonic", old_mnemonic);
      localStorage.removeItem(STORAGE_KEYS.MNEMONIC);
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
    return await client.getSwap(id);
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

  getCorruptedSwapIds(): string[] {
    if (!sdkClient) {
      return [];
    }
    return sdkClient.getCorruptedSwapIds();
  },

  async deleteCorruptedSwaps(): Promise<number> {
    const client = await getSdkClient();
    return await client.deleteCorruptedSwaps();
  },

  async repairCorruptedSwaps(): Promise<{
    repaired: number;
    failed: string[];
  }> {
    const client = await getSdkClient();
    return await client.repairCorruptedSwaps();
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
      "usdc_pol",
      "usdt0_pol",
      "usdc_eth",
      "usdt_eth",
      "xaut_eth",
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
