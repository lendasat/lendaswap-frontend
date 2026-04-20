import { useLiveQuery } from "dexie-react-hooks";
import type { GetSwapResponse } from "../../api";
import { db } from "../../db";
import { CctpDetails } from "./success/CctpDetails";
import { CctpInboundDetails } from "./success/CctpInboundDetails";
import { getBridgeType } from "./success/config";
import { DefaultDetails } from "./success/DefaultDetails";
import { Usdt0Details } from "./success/Usdt0Details";

interface SuccessStepProps {
  swapData: GetSwapResponse;
}

export function SuccessStep({ swapData }: SuccessStepProps) {
  // CCTP source-side inbound swaps have a local session record; if one
  // exists for this swap we render the inbound-specific success view that
  // surfaces the real source chain + burn tx. Takes precedence over the
  // target-side `bridgeType` since an inbound swap can't also be a target
  // bridge (the backend sees it as a plain Arbitrum → BTC swap).
  const cctpInboundSession = useLiveQuery(
    () => db.cctpInboundSessions.get(swapData.id),
    [swapData.id],
  );
  if (cctpInboundSession) {
    return <CctpInboundDetails swapData={swapData} />;
  }

  const bridgeType = getBridgeType(swapData);
  switch (bridgeType) {
    case "cctp":
      return <CctpDetails swapData={swapData} />;
    case "usdt0":
      return <Usdt0Details swapData={swapData} />;
    default:
      return <DefaultDetails swapData={swapData} />;
  }
}
