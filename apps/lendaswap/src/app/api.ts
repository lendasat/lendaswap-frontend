// Re-export types from SDK - single source of truth
import {
  type BtcToArkadeSwapResponse,
  type Chain,
  type ClaimResult,
  type EvmSigner,
  type GetSwapResponse,
  IdbSwapStorage,
  IdbWalletStorage,
  type TokenInfo as PureTokenInfo,
  type QuoteResponse,
  type RefundResult,
  Client as SdkClient,
  type StoredSwap,
  type SupportAgentInfo,
  type SwapStatus,
  type TokenId,
  type TokenInfo,
  type TokenInfos,
  type UnsignedPermit2FundingData,
  type VhtlcAmounts,
} from "@lendasat/lendaswap-sdk-pure";
import { getReferralCode } from "./utils/referralCode";

// Re-export SDK types for use throughout the frontend
export type {
  BtcToArkadeSwapResponse,
  GetSwapResponse,
  PureTokenInfo,
  QuoteResponse,
  RefundResult,
  StoredSwap,
  SupportAgentInfo,
  SwapStatus,
  TokenId,
  TokenInfo,
  TokenInfos,
  VhtlcAmounts,
};
export type Version = { tag: string; commit_hash: string };

export interface EvmTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_uri?: string;
}

export interface EvmTokensResponse {
  chains: Record<string, EvmTokenInfo[]>;
}

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
export { getTokenDisplayName, getTokenIcon } from "./utils/tokenUtils";

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

  async getTokens(): Promise<TokenInfos> {
    const client = await getClients();
    return await client.getTokens();
  },

  async getEvmTokens(): Promise<EvmTokensResponse> {
    const response = await fetch(`${API_BASE_URL}/evm-tokens`);
    if (!response.ok)
      throw new Error(`Failed to fetch EVM tokens: ${response.status}`);
    return response.json();
  },

  async getQuote(request: {
    sourceChain: Chain;
    sourceToken: string;
    targetChain: Chain;
    targetToken: string;
    sourceAmount?: number;
    targetAmount?: number;
  }): Promise<QuoteResponse> {
    const client = await getClients();
    return await client.getQuote(request);
  },

  async createSwap(request: {
    sourceAsset: TokenInfo;
    targetAsset: TokenInfo;
    sourceAmount?: number;
    targetAmount?: number;
    targetAddress: string;
    userAddress?: string;
    gasless?: boolean;
  }): Promise<GetSwapResponse> {
    const referralCode = getReferralCode();
    const client = await getClients();
    const result = await client.createSwap({
      sourceAsset: request.sourceAsset,
      targetAsset: request.targetAsset,
      sourceAmount: request.sourceAmount,
      targetAmount: request.targetAmount,
      targetAddress: request.targetAddress,
      userAddress: request.userAddress,
      referralCode: referralCode || undefined,
      gasless: request.gasless,
    });
    return result.response as GetSwapResponse;
  },

  async getSwap(id: string): Promise<StoredSwap> {
    const client = await getClients();

    try {
      // Try to fetch latest from API and update local storage
      await client.getSwap(id, { updateStorage: true });
    } catch (error) {
      console.error(`Failed refreshing swap from server ${error}`);
    }
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

  async claim(id: string): Promise<ClaimResult> {
    const client = await getClients();
    return await client.claim(id);
  },

  async amountsForSwap(id: string): Promise<VhtlcAmounts> {
    const client = await getClients();
    return await client.amountsForSwap(id);
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

  async refundOnchainHtlc(
    swapId: string,
    refundAddress: string,
  ): Promise<string> {
    const client = await getClients();
    const result = await client.refundSwap(swapId, {
      destinationAddress: refundAddress,
    });
    if (result.success && result.txId && result.broadcast) {
      return result.txId;
    }
    throw new Error(
      `Unable to refund: ${swapId}. ${result.message}. Raw TX '${result.txHex}'`,
    );
  },

  async getPermit2FundingParamsUnsigned(
    swapId: string,
    chainId: number,
  ): Promise<UnsignedPermit2FundingData> {
    const client = await getClients();
    return await client.getPermit2FundingParamsUnsigned(swapId, chainId);
  },

  async fundSwap(
    swapId: string,
    signer: EvmSigner,
  ): Promise<{ txHash: string }> {
    const client = await getClients();
    return await client.fundSwap(swapId, signer);
  },

  async refundEvmSwap(
    swapId: string,
    mode: "swap-back" | "direct" = "swap-back",
  ): Promise<NonNullable<RefundResult["evmRefundData"]>> {
    const client = await getClients();
    const result = await client.refundSwap(swapId, { mode });
    if (result.evmRefundData) {
      return result.evmRefundData;
    }
    throw new Error(
      `Unable to get EVM refund data for: ${swapId}. ${result.message}`,
    );
  },

  async collabRefundEvmSwap(
    swapId: string,
    settlement: "swap-back" | "direct" = "direct",
  ): Promise<{ id: string; txHash: string; message: string }> {
    const client = await getClients();
    return await client.collabRefundEvmSwap(swapId, settlement);
  },

  async buildCollabRefundEvmTypedData(
    swapId: string,
    settlement: "swap-back" | "direct" = "direct",
  ) {
    const client = await getClients();
    return await client.buildCollabRefundEvmTypedData(swapId, settlement);
  },

  /** POST a pre-signed collab refund (for wallet-funded swaps where the wallet signs the EIP-712 digest). */
  async submitCollabRefundEvm(
    swapId: string,
    body: {
      v: number;
      r: string;
      s: string;
      depositor_address: string;
      mode: "direct" | "swap-back";
      sweep_token?: string;
      min_amount_out: string;
    },
  ): Promise<{ id: string; txHash: string; message: string }> {
    const client = await getClients();
    return await client.submitCollabRefundEvm(swapId, body);
  },

  async getVersion(): Promise<{ tag: string; commit_hash: string }> {
    const client = await getClients();
    return await client.getVersion();
  },

  async getSupportAgents(): Promise<SupportAgentInfo[]> {
    const client = await getClients();
    return await client.getSupportAgents();
  },

  async recoverSwaps(): Promise<StoredSwap[]> {
    const client = await getClients();
    return await client.recoverSwaps();
  },

  async getMnemonic(): Promise<string> {
    const client = await getClients();
    return client.getMnemonic();
  },

  async getNostrKeyHex(): Promise<string> {
    const client = await getClients();
    return client.getNostrKeyHex();
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

  async fundSwapGasless(swapId: string): Promise<{ txHash: string }> {
    const client = await getClients();
    return await client.fundSwapGasless(swapId);
  },

  async hasReceivedVtxo(swapId: string): Promise<boolean> {
    const client = await getClients();
    return await client.hasReceivedVtxo(swapId);
  },

  async continueArkadeClaimSwap(swapId: string): Promise<{
    success: boolean;
    message: string;
    txId?: string;
    claimAmount?: bigint;
  }> {
    const client = await getClients();
    return await client.continueArkadeClaimSwap(swapId);
  },
};
