import { useMemo } from "react";
import { useAsync } from "react-use";
import {
  BTC_ARKADE,
  isBtc,
  isBtcOnchain,
  isEvmToken,
  tokenChain,
  type TokenId,
  type TokenInfo,
} from "@lendasat/lendaswap-sdk-pure";
import { api } from "../api";

export function usePairs() {
  const {
    value: tokens,
    loading: isLoading,
    error: tokensError,
  } = useAsync(() => api.getTokens());
  if (tokensError) {
    console.error("Failed loading tokens", tokensError);
  }

  const { btcTokens, evmTokens, allTokens } = useMemo(() => {
    const btc: TokenInfo[] = tokens?.btc_tokens ?? [];
    const evm: TokenInfo[] = tokens?.evm_tokens ?? [];
    return { btcTokens: btc, evmTokens: evm, allTokens: [...btc, ...evm] };
  }, [tokens]);

  // All unique source tokens (deduped by token_id, full TokenInfo)
  const availableSourceAssets: TokenInfo[] = useMemo(() => {
    const seen = new Set<TokenId>();
    const result: TokenInfo[] = [];
    for (const t of allTokens) {
      if (!seen.has(t.token_id)) {
        seen.add(t.token_id);
        result.push(t);
      }
    }
    return result.sort((a, b) => a.token_id.localeCompare(b.token_id));
  }, [allTokens]);

  // Build a lookup map by token_id
  const tokensByIdMap = useMemo(() => {
    const map = new Map<TokenId, TokenInfo>();
    for (const t of allTokens) {
      map.set(t.token_id, t);
    }
    return map;
  }, [allTokens]);

  // Valid targets for a given source:
  //  - BTC onchain → Arkade + all EVM tokens
  //  - BTC (arkade/lightning) → all EVM tokens
  //  - EVM token → all BTC tokens (except onchain)
  function getAvailableTargetAssets(sourceAsset?: TokenId): TokenInfo[] {
    const sort = (list: TokenInfo[]) =>
      list.sort((a, b) => a.token_id.localeCompare(b.token_id));

    if (!sourceAsset) {
      return sort([...allTokens]);
    }

    if (isBtcOnchain(sourceAsset)) {
      const arkade = btcTokens.find((t) => t.token_id === BTC_ARKADE);
      return sort([...(arkade ? [arkade] : []), ...evmTokens]);
    }

    if (isBtc(sourceAsset)) {
      return sort([...evmTokens]);
    }

    if (isEvmToken(tokenChain(sourceAsset))) {
      // EVM → BTC (arkade, lightning); not onchain
      return sort(btcTokens.filter((t) => !isBtcOnchain(t.token_id)));
    }

    // fallback: all BTC tokens
    return sort([...btcTokens]);
  }

  function getDecimals(assetId?: TokenId): number | undefined {
    if (!assetId) {
      return undefined;
    }
    return tokensByIdMap.get(assetId)?.decimals;
  }

  return {
    availableSourceAssets,
    getAvailableTargetAssets,
    tokens: allTokens,
    isLoading,
    getDecimals,
  };
}
