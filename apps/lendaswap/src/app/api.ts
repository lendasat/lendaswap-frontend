// Re-export types from SDK - single source of truth
import {
  type BtcToArkadeSwapResponse,
  type BtcToEvmSwapResponse,
  type CoordinatorFundingCallData,
  type EvmToBtcSwapResponse,
  type GetSwapResponse,
  getUsdPrices,
  IdbSwapStorage,
  IdbWalletStorage,
  type OnchainToEvmSwapResponse,
  type AssetPair as PureAssetPair,
  type TokenInfo as PureTokenInfo,
  type QuoteResponse,
  type RefundResult,
  Client as SdkClient,
  type StoredSwap,
  type SwapStatus,
  type TokenId,
  type TokenInfo,
  type VhtlcAmounts,
  type components,
} from "@lendasat/lendaswap-sdk-pure";
import { getReferralCode } from "./utils/referralCode";
import { getEvmTokenInfo } from "./utils/tokenUtils";

export type {
  PriceTiers,
  PriceUpdateMessage,
  TradingPairPrices,
} from "@lendasat/lendaswap-sdk-pure";

// Derive new generic response types from SDK components
export type ArkadeToEvmSwapResponse =
  components["schemas"]["ArkadeToEvmSwapResponse"];
export type EvmToArkadeSwapResponse =
  components["schemas"]["EvmToArkadeSwapResponse"];
export type TokenSummary = components["schemas"]["TokenSummary"];
export type EvmToArkadeGenericSwapResponse =
  components["schemas"]["EvmToArkadeGenericSwapResponse"];

// Re-export SDK types for use throughout the frontend
export type {
  BtcToArkadeSwapResponse,
  CoordinatorFundingCallData,
  GetSwapResponse,
  PureTokenInfo,
  PureAssetPair,
  BtcToEvmSwapResponse,
  EvmToBtcSwapResponse,
  OnchainToEvmSwapResponse,
  QuoteResponse,
  RefundResult,
  StoredSwap,
  SwapStatus,
  TokenId,
  TokenInfo,
  VhtlcAmounts,
};
export type Version = { tag: string; commit_hash: string };

export interface SwapRequest {
  // Source amount in sats
  source_amount?: bigint;
  target_address: string;
  // Target amount in the asset of choice, e.g. $1 = 1
  target_amount?: number;
  target_token: TokenId;
  referral_code?: string;
}

// Quote request type
export interface QuoteRequest {
  from: TokenId;
  to: TokenId;
  base_amount: number;
}

/**
 * Request to create an EVM to Arkade swap (Token → BTC).
 */
export interface EvmToArkadeSwapRequest {
  target_address: string;
  source_amount: number;
  source_token: TokenId;
  user_address: string;
  referral_code?: string;
}

/**
 * Request to create an EVM to Lightning swap.
 */
export interface EvmToLightningSwapRequest {
  bolt11_invoice: string;
  source_token: TokenId;
  user_address: string;
  referral_code?: string;
}

/**
 * Request to create an on-chain Bitcoin to Arkade swap.
 */
export interface BtcToArkadeSwapRequest {
  /** User's target Arkade address to receive VTXOs */
  target_arkade_address: string;
  /** Amount user wants to receive on Arkade in satoshis */
  sats_receive: number;
  /** Optional referral code */
  referral_code?: string;
}

/**
 * Request to create an on-chain Bitcoin to EVM swap.
 */
export interface OnchainToEvmSwapRequest {
  /** User's EVM address to receive tokens */
  target_address: string;
  /** Amount of BTC to send in satoshis */
  source_amount: bigint;
  /** Target token (e.g., "usdc_pol", "usdt_pol") */
  target_token: TokenId;
  /** Optional referral code */
  referral_code?: string;
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

const ESPLORA_URL =
  import.meta.env.VITE_ESPLORA_URL || "https://mempool.space/api";

// Lazy-initialized SDK clients
let sdkClient: SdkClient | null = null;

async function getClients(): Promise<SdkClient> {
  if (!sdkClient) {
    const walletStorage = new IdbWalletStorage();
    sdkClient = await SdkClient.builder()
      .withBaseUrl(API_BASE_URL)
      .withEsploraUrl(ESPLORA_URL)
      .withSignerStorage(walletStorage)
      .withArkadeServerUrl(ARK_SERVER_URL)
      .withSwapStorage(new IdbSwapStorage())
      .build();

    // If wallet was migrated from v2 (legacy WASM SDK), recover swaps from server
    if (walletStorage.migratedFromLegacy) {
      console.log("Migrated wallet from v2 — recovering swaps from server");
      await sdkClient.recoverSwaps();
    }
  }

  return sdkClient;
}

export const api = {
  async loadMnemonic(mnemonic: string): Promise<void> {
    const client = await getClients();
    await client.loadMnemonic(mnemonic);
  },

  async getAssetPairs(): Promise<PureAssetPair[]> {
    const client = await getClients();
    return await client.getAssetPairs();
  },

  async getTokens(): Promise<PureTokenInfo[]> {
    const client = await getClients();
    return await client.getTokens();
  },

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const client = await getClients();
    return await client.getQuote(request.from, request.to, request.base_amount);
  },

  async createLightningToEvmSwap(
    request: SwapRequest,
    targetNetwork: "ethereum" | "polygon",
  ): Promise<BtcToEvmSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getClients();
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
    const client = await getClients();
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

  async createArkadeToEvmSwapGeneric(request: {
    target_address: string;
    source_amount?: bigint;
    target_amount?: number;
    target_token: TokenId;
  }): Promise<ArkadeToEvmSwapResponse> {
    const referralCode = getReferralCode();
    const evmToken = getEvmTokenInfo(request.target_token);
    if (!evmToken) {
      throw new Error(`Unsupported EVM token: ${request.target_token}`);
    }
    const client = await getClients();
    const result = await client.createArkadeToEvmSwapGeneric({
      targetAddress: request.target_address,
      tokenAddress: evmToken.tokenAddress,
      evmChainId: evmToken.evmChainId,
      sourceAmount: request.source_amount
        ? Number(request.source_amount)
        : undefined,
      targetAmount: request.target_amount,
      referralCode: referralCode || undefined,
    });
    return result.response;
  },

  async createEvmToArkadeSwapGeneric(request: {
    target_address: string;
    source_amount: number;
    source_token: TokenId;
    user_address: string;
  }): Promise<EvmToArkadeGenericSwapResponse> {
    const referralCode = getReferralCode();
    const evmToken = getEvmTokenInfo(request.source_token);
    if (!evmToken) {
      throw new Error(`Unsupported EVM token: ${request.source_token}`);
    }
    const client = await getClients();
    const result = await client.createEvmToArkadeSwapGeneric({
      targetAddress: request.target_address,
      tokenAddress: evmToken.tokenAddress,
      evmChainId: evmToken.evmChainId,
      userAddress: request.user_address,
      sourceAmount: request.source_amount,
      referralCode: referralCode || undefined,
    });
    return result.response;
  },

  async getSwap(id: string): Promise<StoredSwap> {
    const client = await getClients();
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
    const client = await getClients();
    return await client.listAllSwaps();
  },

  async claimGelato(id: string): Promise<void> {
    const client = await getClients();
    await client.claim(id);
  },

  async amountsForSwap(id: string): Promise<VhtlcAmounts> {
    const client = await getClients();
    return await client.amountsForSwap(id);
  },

  async claimVhtlc(id: string): Promise<void> {
    const client = await getClients();
    await client.claim(id);
  },

  async refundVhtlc(id: string, refundAddress: string): Promise<string> {
    const client = await getClients();
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
    const client = await getClients();
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
    const client = await getClients();
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
    request: BtcToArkadeSwapRequest,
  ): Promise<BtcToArkadeSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getClients();
    const result = await client.createBitcoinToArkadeSwap({
      satsReceive: request.sats_receive,
      targetAddress: request.target_arkade_address,
      referralCode: referralCode || undefined,
    });
    return result.response;
  },

  async createOnchainToEvmSwap(
    request: OnchainToEvmSwapRequest,
    targetNetwork: "ethereum" | "polygon",
  ): Promise<OnchainToEvmSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getClients();
    const result = await client.createBitcoinToEvmSwap({
      targetAddress: request.target_address,
      targetToken: request.target_token,
      targetChain: targetNetwork,
      sourceAmount: Number(request.source_amount),
      referralCode: referralCode || undefined,
    });
    return result.response as OnchainToEvmSwapResponse;
  },

  async claimBtcToArkadeVhtlc(swapId: string): Promise<string> {
    const client = await getClients();
    const swap = await client.getStoredSwap(swapId);
    if (!swap) {
      throw new Error("Swap not found");
    }
    const arkadeSwap = swap.response as BtcToArkadeSwapResponse;
    const result = await client.claimArkade(swapId, {
      destinationAddress: arkadeSwap.target_arkade_address,
    });
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.txId ?? "";
  },

  async refundOnchainHtlc(
    swapId: string,
    refundAddress: string,
  ): Promise<string> {
    const client = await getClients();
    const result = await client.refundSwap(swapId, {
      destinationAddress: refundAddress,
    });
    if (result.success && result.txId) {
      return result.txId;
    }
    throw new Error(`Unable to refund: ${swapId}. ${result.message}`);
  },

  async getCoordinatorFundingCallData(
    swapId: string,
    tokenDecimals: number,
  ): Promise<CoordinatorFundingCallData> {
    const client = await getClients();
    return await client.getCoordinatorFundingCallData(swapId, tokenDecimals);
  },

  async refundEvmSwap(
    swapId: string,
  ): Promise<NonNullable<RefundResult["evmRefundData"]>> {
    const client = await getClients();
    const result = await client.refundSwap(swapId);
    if (result.evmRefundData) {
      return result.evmRefundData;
    }
    throw new Error(
      `Unable to get EVM refund data for: ${swapId}. ${result.message}`,
    );
  },

  async getVersion(): Promise<{ tag: string; commit_hash: string }> {
    const client = await getClients();
    return await client.getVersion();
  },

  async recoverSwaps(): Promise<StoredSwap[]> {
    const client = await getClients();
    return await client.recoverSwaps();
  },

  async getMnemonic(): Promise<string> {
    const client = await getClients();
    return client.getMnemonic();
  },

  async getUserIdXpub() {
    const client = await getClients();
    return client.getUserIdXpub();
  },

  async clearSwapStorage(): Promise<void> {
    const client = await getClients();
    await client.clearSwapStorage();
  },

  async deleteSwap(id: string): Promise<void> {
    const client = await getClients();
    await client.deleteSwap(id);
  },

  /**
   * Fetch USD prices for all supported tokens from CoinGecko.
   * Returns a Map of tokenId -> USD price.
   */
  async getTokenUsdPrices(): Promise<Map<string, number>> {
    const tokenIds: TokenId[] = [
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

// PriceFeedService
export { PriceFeedService } from "@lendasat/lendaswap-sdk-pure";
