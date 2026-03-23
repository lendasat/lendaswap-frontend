import type { EvmSigner } from "@lendasat/lendaswap-sdk-pure";
import {
  type Account,
  type Chain,
  createPublicClient,
  http,
  type Transport,
  type WalletClient,
} from "viem";

/**
 * Build an {@link EvmSigner} from a wagmi/viem `WalletClient`.
 *
 * Creates a dedicated `publicClient` for reads so we bypass the wallet
 * transport (which can return raw JSON-RPC envelopes instead of parsed values).
 */
export function buildEvmSigner(
  walletClient: WalletClient<Transport, Chain, Account>,
  chain: Chain,
): EvmSigner {
  const rpcUrl =
    import.meta.env.VITE_RPC_OVERRIDE_CHAIN_ID === String(chain.id)
      ? import.meta.env.VITE_RPC_OVERRIDE_URL
      : undefined;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  return {
    address: walletClient.account.address,
    chainId: chain.id,
    signTypedData: (td) =>
      walletClient.signTypedData({
        ...td,
        domain: {
          ...td.domain,
          verifyingContract: td.domain.verifyingContract as `0x${string}`,
        },
        account: walletClient.account,
      }),
    sendTransaction: (tx: { to: string; data: string; gas?: bigint }) =>
      walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        chain,
        gas: tx.gas,
      }),
    getTransactionReceipt: async (hash) => {
      const receipt = await publicClient.getTransactionReceipt({
        hash: hash as `0x${string}`,
      });
      return {
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
      };
    },
    getTransaction: async (hash) => {
      const tx = await publicClient.getTransaction({
        hash: hash as `0x${string}`,
      });
      return { to: tx.to ?? null, input: tx.input, from: tx.from };
    },
    call: async (tx) => {
      const result = await publicClient.call({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        account: tx.from as `0x${string}` | undefined,
        blockNumber: tx.blockNumber,
      });
      return result.data ?? "0x";
    },
  };
}
