import {
  Bitcoin,
  CheckCheck,
  Clock,
  Copy,
  ExternalLink,
  QrCode,
} from "lucide-react";
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
      {/* Swap ID Header */}
      <div className="px-6 py-4 flex items-center gap-3 border-b border-border/50 bg-muted/30">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Swap ID:
        </p>
        <code className="text-xs font-mono text-foreground flex-1">
          {swapId}
        </code>
        <div className="h-2 w-2 rounded-full bg-primary/50 animate-pulse" />
      </div>

      {/* Content */}
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col items-center space-y-4 py-2">
          <div className="rounded-full bg-orange-500/10 p-4">
            <Bitcoin className="h-12 w-12 text-orange-500" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Send On-Chain Bitcoin</h3>
            <p className="text-sm text-muted-foreground">
              Send the exact amount to the address below from your Bitcoin
              wallet
            </p>
          </div>
        </div>

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
          <div className="rounded-lg bg-white p-2">
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
        <div className="bg-muted/50 space-y-3 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount to Send</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-orange-500">
                {swapData.source_amount.toLocaleString()} sats
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleCopy(swapData.source_amount.toString())}
                className="h-6 w-6"
              >
                {copiedValue === swapData.source_amount.toString() ? (
                  <CheckCheck className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
          {swapData.target_token.isArkade() ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                You Receive on Arkade
              </span>
              <span className="font-medium">
                {(
                  swapData as BtcToArkadeSwapResponse
                ).target_amount.toLocaleString()}{" "}
                sats
              </span>
            </div>
          ) : null}
          {swapData.target_token.isEvmToken() ? (
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
          ) : null}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-medium">
              {swapData.fee_sats.toLocaleString()} sats
            </span>
          </div>
        </div>

        {/* Time Remaining */}
        {timeRemaining && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <div>
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Time Remaining
                </p>
                <p className="text-xl font-bold text-orange-900 dark:text-orange-100 font-mono">
                  {timeRemaining}
                </p>
              </div>
            </div>
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
              Send your Bitcoin before this time expires. After expiry, you can
              request a refund.
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Important Instructions
          </p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>
              Send the <strong>exact amount</strong> shown above
            </li>
            <li>Use any Bitcoin wallet that supports on-chain transactions</li>
            <li>Wait for at least 1 confirmation after sending</li>
            <li>
              This page will automatically update when payment is detected
            </li>
          </ul>
        </div>

        {/* Waiting indicator */}
        <Button className="h-12 w-full text-base font-semibold" disabled={true}>
          Waiting for on-chain payment...
        </Button>

        {/* Cancel button */}
        <Button
          variant="outline"
          className="h-12 w-full"
          onClick={() => navigate("/")}
        >
          Cancel Swap
        </Button>
      </div>
    </div>
  );
}
