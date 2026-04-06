import type { GetSwapResponse } from "../../api";
import { CctpDetails } from "./success/CctpDetails";
import { getBridgeType } from "./success/config";
import { DefaultDetails } from "./success/DefaultDetails";
import { Usdt0Details } from "./success/Usdt0Details";

interface SuccessStepProps {
  swapData: GetSwapResponse;
}

export function SuccessStep({ swapData }: SuccessStepProps) {
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
