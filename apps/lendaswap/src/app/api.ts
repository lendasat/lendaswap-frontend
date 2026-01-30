// Re-export types from SDK - single source of truth
import {
  type BtcToArkadeSwapRequest,
  type BtcToArkadeSwapResponse,
  type Chain,
  type EvmToArkadeSwapRequest,
  type EvmToLightningSwapRequest,
  type GetSwapResponse,
  getUsdPrices,
  type OnchainToEvmSwapRequest,
  type RecoveredSwap,
  type RecoverSwapsResponse,
  type SwapRequest,
  SwapStatus,
  type TokenIdString,
} from "@lendasat/lendaswap-sdk";
import {
  type BtcToEvmSwapResponse,
  type EvmToBtcSwapResponse,
  IdbSwapStorage,
  type OnchainToEvmSwapResponse,
  IdbWalletStorage,
  type AssetPair as PureAssetPair,
  Client as SdkClient,
  type TokenInfo as PureTokenInfo,
  type QuoteResponse,
  type StoredSwap,
  type VhtlcAmounts,
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
  VhtlcAmounts,
};

export type Version = { tag: string; commit_hash: string };
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

  async claimBtcToArkadeVhtlc(_swapId: string): Promise<string> {
    // FIXME: needs to be implement in client first
    throw new Error(
      "claimBtcToArkadeVhtlc is not yet supported in the pure SDK",
    );
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

// PriceFeedService
export { PriceFeedService } from "@lendasat/lendaswap-sdk";
