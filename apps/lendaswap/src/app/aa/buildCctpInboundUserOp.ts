/**
 * Thin re-export of the SDK's CCTP-inbound batch builder.
 *
 * The real implementation lives in `@lendasat/lendaswap-sdk-pure`
 * (`cctp-inbound/userOp.ts`). This module exists only as a compat
 * shim during the SDK refactor; delete it when the wizard is pointed
 * directly at `client.cctpInbound.buildUserOpBatch(...)`.
 */

export {
  addressToBytes32Hex,
  type BatchCall,
  type BuildCctpInboundBatchParams,
  type BuiltBatch,
  buildCctpInboundBatch,
  type SignTypedDataFn,
  type UseropCalldataResponse,
} from "@lendasat/lendaswap-sdk-pure";
