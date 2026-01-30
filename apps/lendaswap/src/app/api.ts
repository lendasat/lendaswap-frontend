// Re-export types from SDK - single source of truth
import {
  type BtcToArkadeSwapRequest,
  type BtcToArkadeSwapResponse,
  type Chain,
  type EvmToArkadeSwapRequest,
  type EvmToLightningSwapRequest,
  type ExtendedSwapStorageData,
  type GetSwapResponse,
  getUsdPrices,
  type OnchainToEvmSwapRequest,
  type OnchainToEvmSwapResponse,
  type RecoveredSwap,
  type RecoverSwapsResponse,
  Client as SdkClient,
  type SwapRequest,
  SwapStatus,
  type TokenIdString,
  type Version,
  type VhtlcAmounts,
} from "@lendasat/lendaswap-sdk";
import {
  type BtcToEvmSwapResponse,
  type EvmToBtcSwapResponse,
  IdbSwapStorage,
  IdbWalletStorage,
  type AssetPair as PureAssetPair,
  Client as PureClient,
  type TokenInfo as PureTokenInfo,
  type QuoteResponse,
  type StoredSwap,
} from "@lendasat/lendaswap-sdk-pure";
import { getReferralCode } from "./utils/referralCode";

// Re-export SDK types for use throughout the frontend
export type {
  TokenIdString,
  Chain,
  PureTokenInfo,
  PureAssetPair,
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
  StoredSwap,
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

// Lazy-initialized SDK clients
let legacyClient: SdkClient | null = null;
let pureClient: PureClient | null = null;

interface SdkClients {
  legacy: SdkClient;
  pure: PureClient;
}

async function getClients(): Promise<SdkClients> {
  if (!legacyClient) {
    legacyClient = await SdkClient.builder()
      .url(API_BASE_URL)
      .withIdbStorage()
      .network(BITCOIN_NETWORK)
      .arkadeUrl(ARK_SERVER_URL)
      .esploraUrl(ESPLORA_URL)
      .build();

    await legacyClient.init();
  }

  if (!pureClient) {
    pureClient = await PureClient.builder()
      .withBaseUrl(API_BASE_URL)
      .withEsploraUrl(ESPLORA_URL)
      .withSignerStorage(new IdbWalletStorage())
      .withSwapStorage(new IdbSwapStorage())
      .build();
  }

  return { legacy: legacyClient, pure: pureClient };
}

export const api = {
  async loadMnemonic(mnemonic: string): Promise<void> {
    const { pure: client } = await getClients();
    await client.loadMnemonic(mnemonic);
  },

  async getAssetPairs(): Promise<PureAssetPair[]> {
    const { pure: client } = await getClients();
    return await client.getAssetPairs();
  },

  async getTokens(): Promise<PureTokenInfo[]> {
    const { pure: newClient } = await getClients();
    return await newClient.getTokens();
  },

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const { pure: client } = await getClients();
    return await client.getQuote(request.from, request.to, request.base_amount);
  },

  async createLightningToEvmSwap(
    request: SwapRequest,
    targetNetwork: "ethereum" | "polygon",
  ): Promise<BtcToEvmSwapResponse> {
    const referralCode = getReferralCode();
    const { pure: client } = await getClients();
    const result = await client.createLightningToEvmSwap({
      targetAddress: request.target_address,
      targetToken: request.target_token,
      targetChain: targetNetwork,
      sourceAmount: request.source_amount
        ? Number(request.source_amount)
        : undefined,
      targetAmount: request.target_amount,
      referralCode: referralCode || undefined,
    });
    return result.response;
  },

  async createArkadeToEvmSwap(
    request: SwapRequest,
    targetNetwork: "ethereum" | "polygon",
  ): Promise<BtcToEvmSwapResponse> {
    const referralCode = getReferralCode();
    const { pure: client } = await getClients();
    const result = await client.createArkadeToEvmSwap({
      targetAddress: request.target_address,
      targetToken: request.target_token,
      targetChain: targetNetwork,
      sourceAmount: request.source_amount
        ? Number(request.source_amount)
        : undefined,
      targetAmount: request.target_amount,
      referralCode: referralCode || undefined,
    });
    return result.response;
  },

  async getSwap(id: string): Promise<StoredSwap> {
    const { pure: client } = await getClients();
    // Fetch latest from API and update local storage
    await client.getSwap(id, { updateStorage: true });
    // Return the stored swap (includes preimage and keys)
    const stored = await client.getStoredSwap(id);
    if (!stored) {
      throw new Error("Swap not found");
    }
    return stored;
  },

  async listAllSwaps(): Promise<StoredSwap[]> {
    const { pure: client } = await getClients();
    return await client.listAllSwaps();
  },

  async claimGelato(id: string): Promise<void> {
    const { pure: client } = await getClients();
    await client.claim(id);
  },

  async amountsForSwap(id: string): Promise<VhtlcAmounts> {
    const { legacy: client } = await getClients();
    return await client.amountsForSwap(id);
  },

  async claimVhtlc(id: string): Promise<void> {
    const { pure: client } = await getClients();
    await client.claim(id);
  },

  async refundVhtlc(id: string, refundAddress: string): Promise<string> {
    const { pure: client } = await getClients();
    const result = await client.refundSwap(id, {
      destinationAddress: refundAddress,
    });
    if (result.success && result.txId) {
      return result.txId;
    }
    throw Error(`Unable to refund: ${id}. Due to ${result.message}`);
  },

  async createEvmToArkadeSwap(
    request: EvmToArkadeSwapRequest,
    sourceNetwork: "ethereum" | "polygon",
  ): Promise<EvmToBtcSwapResponse> {
    const referralCode = getReferralCode();
    const { pure: client } = await getClients();
    const result = await client.createEvmToArkadeSwap({
      targetAddress: request.target_address,
      sourceAmount: request.source_amount,
      sourceToken: request.source_token,
      userAddress: request.user_address,
      sourceChain: sourceNetwork,
      referralCode: referralCode || undefined,
    });
    return result.response;
  },

  async createEvmToLightningSwap(
    request: EvmToLightningSwapRequest,
    sourceNetwork: "ethereum" | "polygon",
  ): Promise<EvmToBtcSwapResponse> {
    const referralCode = getReferralCode();
    const { pure: client } = await getClients();
    const result = await client.createEvmToLightningSwap({
      bolt11Invoice: request.bolt11_invoice,
      sourceToken: request.source_token,
      userAddress: request.user_address,
      sourceChain: sourceNetwork,
      referralCode: referralCode || undefined,
    });
    return result.response;
  },

  async createBitcoinToArkadeSwap(
    _request: BtcToArkadeSwapRequest,
  ): Promise<void> {
    throw new Error(
      "createBitcoinToArkadeSwap is not yet supported in the pure SDK",
    );
  },

  async createOnchainToEvmSwap(
    request: OnchainToEvmSwapRequest,
    targetNetwork: "ethereum" | "polygon",
  ): Promise<OnchainToEvmSwapResponse> {
    const referralCode = getReferralCode();
    const { legacy: client } = await getClients();
    return await client.createOnchainToEvmSwap(
      {
        ...request,
        referral_code: referralCode || undefined,
      },
      targetNetwork,
    );
  },

  async claimBtcToArkadeVhtlc(swapId: string): Promise<string> {
    const { legacy: client } = await getClients();
    return await client.claimBtcToArkadeVhtlc(swapId);
  },

  async refundOnchainHtlc(
    swapId: string,
    refundAddress: string,
  ): Promise<string> {
    const { legacy: client } = await getClients();
    return await client.refundOnchainHtlc(swapId, refundAddress);
  },

  async getVersion(): Promise<Version> {
    const { legacy: client } = await getClients();
    return await client.getVersion();
  },

  async recoverSwaps(): Promise<ExtendedSwapStorageData[]> {
    const { legacy: client } = await getClients();
    return await client.recoverSwaps();
  },

  async getMnemonic(): Promise<string> {
    const { legacy: client } = await getClients();
    return await client.getMnemonic();
  },

  async getUserIdXpub() {
    const { legacy: client } = await getClients();
    return await client.getUserIdXpub();
  },

  async clearSwapStorage(): Promise<void> {
    const { legacy: client } = await getClients();
    return await client.clearSwapStorage();
  },

  async deleteSwap(id: string): Promise<void> {
    const { legacy: client } = await getClients();
    return await client.deleteSwap(id);
  },

  // TODO: remove concept of corrupted swaps
  getCorruptedSwapIds(): string[] {
    if (!legacyClient) {
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
