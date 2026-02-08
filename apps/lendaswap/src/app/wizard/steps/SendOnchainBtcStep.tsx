import { isArkade, isEvmToken } from "@lendasat/lendaswap-sdk-pure";
import { CheckCheck, Clock, Copy, ExternalLink, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "#/components/ui/button";
import {
  type BtcToArkadeSwapResponse,
  getTokenNetworkName,
  getTokenSymbol,
  type OnchainToEvmSwapResponse,
  type TokenInfo,
} from "../../api";
import { getTokenIcon, getTokenNetworkIcon } from "../../utils/tokenUtils";

interface SendOnchainBtcStepProps {
  swapData: BtcToArkadeSwapResponse | OnchainToEvmSwapResponse;
  swapId: string;
  // the token which is being swapped
  targetTokenInfo: TokenInfo;
}

export function SendOnchainBtcStep({
  swapData,
  swapId,
  targetTokenInfo,
}: SendOnchainBtcStepProps) {
  const navigate = useNavigate();
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);

  // Countdown timer state
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const shortenAddress = (address: string, startChars = 12, endChars = 12) => {
    if (address.length <= startChars + endChars) {
      return address;
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  };

  // Calculate time remaining until refund locktime
  const timeRemaining = useMemo(() => {
    const secondsLeft = Number(swapData.btc_refund_locktime) - now;
    if (secondsLeft <= 0) return null;

    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, [now, swapData.btc_refund_locktime]);

  // Build bitcoin: URI for QR code
  const btcAmountInBtc = (Number(swapData.source_amount) / 100_000_000).toFixed(
    8,
  );
  const bitcoinUri = `bitcoin:${swapData.btc_htlc_address}?amount=${btcAmountInBtc}`;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-muted border border-border">
              <div className="w-5 h-5 flex items-center justify-center">
                {getTokenIcon("btc_onchain")}
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background p-[1px] flex items-center justify-center">
              <div className="w-full h-full rounded-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full">
                {getTokenNetworkIcon("btc_onchain")}
              </div>
            </div>
          </div>
          <h3 className="text-sm font-semibold">Send BTC</h3>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono text-muted-foreground">
            {swapId.slice(0, 8)}…
          </code>
          <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-5 p-5">
        {/* QR Code Toggle - Mobile */}
        <div className="md:hidden">
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={() => setShowQrCode(!showQrCode)}
          >
            <QrCode className="mr-2 h-5 w-5" />
            {showQrCode ? "Hide QR Code" : "Show QR Code"}
          </Button>
        </div>

        {/* QR Code display */}
        <div
          className={`flex flex-col items-center space-y-4 ${showQrCode ? "block" : "hidden"} md:flex`}
        >
          <div className="rounded-lg bg-white p-1">
            <QRCodeSVG value={bitcoinUri} size={200} level="M" />
          </div>
        </div>

        {/* Bitcoin HTLC Address */}
        <div className="w-full space-y-2">
          <div className="text-muted-foreground text-sm font-medium">
            Bitcoin Address
          </div>
          <div className="flex items-center gap-2">
            <div className="dark:bg-muted/50 border-border flex-1 rounded-lg border bg-white p-3 font-mono text-xs">
              <span className="md:hidden">
                {shortenAddress(swapData.btc_htlc_address)}
              </span>
              <span className="hidden md:inline break-all">
                {swapData.btc_htlc_address}
              </span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleCopy(swapData.btc_htlc_address)}
              className="shrink-0"
            >
              {copiedValue === swapData.btc_htlc_address ? (
                <CheckCheck className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <a
            href={`https://mempool.space/address/${swapData.btc_htlc_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            View on mempool.space <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Amount Details */}
        <div className="bg-muted/50 space-y-2 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You Send</span>
            <span className="font-medium">
              {swapData.source_amount.toLocaleString()} sats
            </span>
          </div>
          {isArkade(swapData.target_token) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You Receive</span>
              <span className="font-medium">
                {(
                  swapData as BtcToArkadeSwapResponse
                ).target_amount.toLocaleString()}{" "}
                sats on Arkade
              </span>
            </div>
          )}
          {isEvmToken(swapData.target_token) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You Receive</span>
              <span className="font-medium">
                {(swapData.target_amount as number).toFixed(
                  targetTokenInfo.decimals,
                )}{" "}
                {getTokenSymbol(swapData.target_token)} on{" "}
                {getTokenNetworkName(swapData.target_token)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-medium">
              {swapData.fee_sats.toLocaleString()} sats
            </span>
          </div>
          {timeRemaining && (
            <div className="flex justify-between text-sm pt-1 border-t border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Expires in
              </span>
              <span className="font-medium font-mono">{timeRemaining}</span>
            </div>
          )}
        </div>

        {/* Hint */}
        <p className="text-xs text-muted-foreground text-center">
          Send the exact amount above. This page updates automatically once
          payment is detected.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            className="h-12 w-full text-base font-semibold"
            disabled={true}
          >
            Waiting for payment
          </Button>

          <Button
            variant="outline"
            className="h-12 w-full"
            onClick={() => navigate("/")}
          >
            Cancel Swap
          </Button>
        </div>
      </div>
    </div>
  );
}
