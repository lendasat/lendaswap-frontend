/**
 * The full fee a swap charges, in sats.
 *
 * Most swap responses fold the network fee into `fee_sats`. The responses
 * with a Lightning leg (Arkade/EVM → Lightning, Lightning → Arkade) report
 * the protocol fee alone and keep the send fee and claim gas in
 * `network_fee_sats`. Both come out of the source amount, so a displayed
 * fee must add them or it understates what the user pays.
 */
export function totalFeeSats(swap: {
  fee_sats: number;
  network_fee_sats?: number;
}): number {
  return swap.fee_sats + (swap.network_fee_sats ?? 0);
}
