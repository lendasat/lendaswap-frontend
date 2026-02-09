import { useAsync } from "react-use";
import {
  BTC_ARKADE,
  BTC_LIGHTNING,
  isBtc,
  isBtcOnchain,
  isEvmToken,
  isLightning,
  type TokenId,
} from "@lendasat/lendaswap-sdk-pure";
import { api } from "../api";

export function usePairs() {
  const { value: assetPairs, error: pairsError } = useAsync(() =>
    api.getAssetPairs(),
  );
  if (pairsError) {
    console.error("Failed loading asset pairs", pairsError);
  }

  const { value: tokens, error: tokensError } = useAsync(() => api.getTokens());
  if (tokensError) {
    console.error("Failed loading tokens", tokensError);
  }

  const { error: evmTokensError } = useAsync(() => api.getEvmTokens());
  if (evmTokensError) {
    console.error("Failed loading EVM tokens", evmTokensError);
  }

  const pairs = assetPairs || [];
  const tokenList = tokens || [];
  const isLoading = !assetPairs || !tokens;

  // All source assets from pairs
  const availableSourceAssets: TokenId[] = [
    ...new Map(
      pairs.map((a) => [a.source.token_id, a.source.token_id]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));

  // Compute available target assets based on selected source
  function getAvailableTargetAssets(sourceAsset: TokenId): TokenId[] {
    if (isBtcOnchain(sourceAsset)) {
      return [
        BTC_ARKADE,
        ...availableSourceAssets.filter(
          (a) => isEvmToken(a) && !isBtcOnchain(a) && !isLightning(a),
        ),
      ].sort((a, b) => a.localeCompare(b));
    }

    if (isEvmToken(sourceAsset)) {
      return [
        ...availableSourceAssets.filter(
          (a) => !isEvmToken(a) && a !== sourceAsset && !isBtcOnchain(a),
        ),
      ].sort((a, b) => a.localeCompare(b));
    }

    if (isBtc(sourceAsset)) {
      return [...availableSourceAssets.filter((a) => isEvmToken(a))].sort(
        (a, b) => a.localeCompare(b),
      );
    }

    // fallback
    return [
      ...new Map(
        [
          ...availableSourceAssets.filter((a) => !isBtc(a)),
          BTC_LIGHTNING,
          BTC_ARKADE,
        ].map((t) => [t, t]),
      ).values(),
    ]
      .filter((asset) => !isBtcOnchain(asset))
      .sort((a, b) => a.localeCompare(b));
  }

  function getSourceDecimals(sourceAsset: TokenId): number | undefined {
    return pairs.find((p) => p.source.token_id === sourceAsset)?.source
      .decimals;
  }

  function getTargetDecimals(targetAsset: TokenId): number | undefined {
    return pairs.find((p) => p.target.token_id === targetAsset)?.target
      .decimals;
  }

  return {
    availableSourceAssets,
    getAvailableTargetAssets,
    tokens: tokenList,
    isLoading,
    getSourceDecimals,
    getTargetDecimals,
  };
}
