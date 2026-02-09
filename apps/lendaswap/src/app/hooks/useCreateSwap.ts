import { useState } from "react";
import { useNavigate } from "react-router";
import { usePostHog } from "posthog-js/react";
import {
  BTC_ARKADE,
  BTC_LIGHTNING,
  isArkade,
  isBtc,
  isBtcOnchain,
  isEvmToken,
  isLightning,
  networkName,
  type TokenId,
} from "@lendasat/lendaswap-sdk-pure";
import {
  isLightningAddress,
  resolveLightningAddress,
} from "../../utils/lightningAddress";
import { api, type GetSwapResponse } from "../api";
import { hasReferralCode } from "../utils/referralCode";

interface UseCreateSwapParams {
  sourceAsset: TokenId;
  targetAsset: TokenId;
  sourceAssetAmount: number | undefined;
  targetAssetAmount: number | undefined;
  targetAddress: string;
  userEvmAddress: string;
  isEvmAddressValid: boolean;
  lastFieldEdited: "sourceAsset" | "targetAsset";
}

export function useCreateSwap(params: UseCreateSwapParams) {
  const {
    sourceAsset,
    targetAsset,
    sourceAssetAmount,
    targetAssetAmount,
    targetAddress,
    userEvmAddress,
    isEvmAddressValid,
    lastFieldEdited,
  } = params;

  const navigate = useNavigate();
  const posthog = usePostHog();
  const [isCreatingSwap, setIsCreatingSwap] = useState(false);
  const [swapError, setSwapError] = useState<string>("");

  const trackSwapInitiation = (swap: GetSwapResponse) => {
    let swapDirection: string;
    if (isBtcOnchain(swap.source_token) && isArkade(swap.target_token)) {
      swapDirection = "btc-to-arkade";
    } else if (
      isBtcOnchain(swap.source_token) &&
      isEvmToken(swap.target_token)
    ) {
      swapDirection = "onchain-to-evm";
    } else if (isBtc(swap.source_token) && isEvmToken(swap.target_token)) {
      swapDirection = "btc-to-evm";
    } else if (isEvmToken(swap.source_token) && isBtc(swap.target_token)) {
      swapDirection = "evm-to-btc";
    } else {
      swapDirection = "unknown";
    }
    const amountSats =
      "sats_receive" in swap
        ? (swap as { sats_receive: number }).sats_receive
        : "btc_expected_sats" in swap
          ? (swap as { btc_expected_sats: number }).btc_expected_sats
          : 0;
    posthog?.capture("swap_initiated", {
      swap_id: swap.id,
      swap_direction: swapDirection,
      source_token: swap.source_token,
      target_token: swap.target_token,
      amount_asset: swap.source_amount,
      amount_sats: amountSats,
      has_referral_code: hasReferralCode(),
    });
  };

  const createSwap = async () => {
    try {
      setIsCreatingSwap(true);
      setSwapError("");

      // Detect swap direction
      const isBtcSource = isBtc(sourceAsset);
      const isEvmSource = isEvmToken(sourceAsset);
      const isOnchainBtcSource = isBtcOnchain(sourceAsset);

      // On-chain BTC → Arkade
      if (isOnchainBtcSource && isArkade(targetAsset)) {
        const satsToReceive = Math.floor(
          (sourceAssetAmount ?? 0) * 100_000_000,
        );

        const swap = await api.createBitcoinToArkadeSwap({
          target_arkade_address: targetAddress,
          sats_receive: satsToReceive,
        });

        trackSwapInitiation(swap);
        navigate(`/swap/${swap.id}/wizard`);
        return;
      }

      // On-chain BTC → EVM
      if (isOnchainBtcSource && isEvmToken(targetAsset)) {
        const sourceAmount = sourceAssetAmount
          ? BigInt(Math.round(sourceAssetAmount * 100_000_000))
          : BigInt(0);

        const parsedNetworkName = networkName(targetAsset) as
          | "ethereum"
          | "polygon";

        const swap = await api.createOnchainToEvmSwap(
          {
            target_address: targetAddress,
            source_amount: sourceAmount,
            target_token: targetAsset,
          },
          parsedNetworkName,
        );

        trackSwapInitiation(swap);
        navigate(`/swap/${swap.id}/wizard`);
        return;
      }

      if (isBtcSource && !isOnchainBtcSource) {
        // BTC (Arkade/Lightning) → EVM
        let sourceAmount: bigint | undefined;
        let targetAmount: number | undefined;

        if (lastFieldEdited === "targetAsset") {
          targetAmount = targetAssetAmount;
          console.log(
            `Creating a swap to receive ${targetAmount} ${targetAsset}`,
          );
        } else {
          sourceAmount = sourceAssetAmount
            ? BigInt(Math.round(sourceAssetAmount * 100000000))
            : undefined;
          console.log(`Creating a swap to send ${sourceAmount} sats`);
        }

        const parsedNetworkName = networkName(targetAsset) as
          | "ethereum"
          | "polygon";
        switch (sourceAsset) {
          case BTC_LIGHTNING: {
            const swap = await api.createLightningToEvmSwap(
              {
                target_address: targetAddress,
                source_amount: sourceAmount,
                target_amount: targetAmount,
                target_token: targetAsset,
              },
              parsedNetworkName,
            );

            trackSwapInitiation(swap);
            navigate(`/swap/${swap.id}/wizard`);
            break;
          }
          case BTC_ARKADE: {
            const swap = await api.createArkadeToEvmSwap({
              target_address: targetAddress,
              source_amount: sourceAmount,
              target_amount: targetAmount,
              target_token: targetAsset,
            });

            posthog?.capture("swap_initiated", {
              swap_id: swap.id,
              swap_direction: "arkade-to-evm",
              source_token: swap.source_token.symbol,
              target_token: swap.target_token.symbol,
              amount_sats: swap.btc_expected_sats,
              has_referral_code: hasReferralCode(),
            });
            navigate(`/swap/${swap.id}/wizard`);
            break;
          }
          default:
            console.error(`Invalid source asset ${sourceAsset}`);
            return;
        }
      } else if (isEvmSource) {
        // EVM → Bitcoin

        // Validate EVM address
        if (!isEvmAddressValid) {
          setSwapError(`Please provide a valid wallet address`);
          return;
        }

        if (isArkade(targetAsset)) {
          // EVM → Arkade

          // Call EVM → Arkade generic API
          const swap = await api.createEvmToArkadeSwapGeneric({
            target_address: targetAddress, // Arkade address
            source_amount: sourceAssetAmount ?? 0,
            source_token: sourceAsset,
            user_address: userEvmAddress,
          });

          console.log(`Created swap ${swap.id}`);

          posthog?.capture("swap_initiated", {
            swap_id: swap.id,
            swap_direction: "evm-to-arkade",
            source_token: swap.source_token.symbol,
            target_token: swap.target_token.symbol,
            amount_sats: swap.btc_expected_sats,
            has_referral_code: hasReferralCode(),
          });
          navigate(`/swap/${swap.id}/wizard`);
        }

        if (isLightning(targetAsset)) {
          // EVM → Lightning

          // Resolve Lightning address to BOLT11 invoice if needed
          let bolt11Invoice = targetAddress;
          if (isLightningAddress(targetAddress)) {
            try {
              const amountSats = (targetAssetAmount ?? 0) * 100_000_000; // Convert BTC to sats
              bolt11Invoice = await resolveLightningAddress(
                targetAddress,
                amountSats,
              );
            } catch (error) {
              setSwapError(
                `Failed to resolve Lightning address: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
              return;
            }
          }

          // Call EVM → Lightning API
          const swap = await api.createEvmToLightningSwap(
            {
              bolt11_invoice: bolt11Invoice,
              source_token: sourceAsset,
              user_address: userEvmAddress,
            },
            networkName(sourceAsset) as "ethereum" | "polygon",
          );

          trackSwapInitiation(swap);
          navigate(`/swap/${swap.id}/wizard`);
        }
      }
    } catch (error) {
      console.error("Failed to create swap:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to create swap: ${error}`;
      setSwapError(errorMessage);

      posthog?.capture("swap_failed", {
        failure_type: "creation",
        error_message: errorMessage,
        source_token: sourceAsset,
        target_token: targetAsset,
      });
    } finally {
      setIsCreatingSwap(false);
    }
  };

  return {
    createSwap,
    isCreatingSwap,
    swapError,
  };
}
