/**
 * PolygonHTLCMonitor
 *
 * Monitors the Polygon blockchain for HTLC creation after the user funds Bitcoin.
 * Once lendaswap detects Bitcoin funding, it creates a Polygon HTLC with the client's hash_lock.
 *
 * This component:
 * 1. Connects to Polygon RPC
 * 2. Watches for SwapCreated events on the HTLC contract
 * 3. Filters by the client's hash_lock
 * 4. Notifies when the HTLC is detected (ready to claim)
 *
 */

import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { polygon } from "viem/chains";

const HTLC_CONTRACT_ADDRESS = import.meta.env.VITE_HTLC_ADDRESS || "";
const POLYGON_RPC_URL =
  import.meta.env.VITE_POLYGON_RPC || "https://polygon-rpc.com";

interface PolygonHTLCMonitorProps {
  swapId: string;
  hashLock: string;
  expectedAmountSats: number;
  onHTLCDetected: (htlcSwapId: string) => void;
}

export function PolygonHTLCMonitor({
  swapId: _swapId,
  hashLock,
  expectedAmountSats: _expectedAmountSats,
  onHTLCDetected,
}: PolygonHTLCMonitorProps) {
  const [status, setStatus] = useState<"waiting" | "detected" | "error">(
    "waiting",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Create viem public client
    const client = createPublicClient({
      chain: polygon,
      transport: http(POLYGON_RPC_URL),
    });

    // 2. Define SwapCreated event ABI
    const swapCreatedEvent = parseAbiItem(
      "event SwapCreated(bytes32 indexed swapId, address indexed recipient, address tokenIn, address tokenOut, uint256 amountIn, bytes32 indexed hashLock, uint256 timelock, uint24 poolFee)",
    );

    // 3. Poll for events
    const pollInterval = setInterval(async () => {
      try {
        // Get the current block number and look back 1000 blocks (~30 mins on Polygon)
        const latestBlock = await client.getBlockNumber();
        const fromBlock = latestBlock - 1000n;

        const logs = await client.getLogs({
          address: HTLC_CONTRACT_ADDRESS as `0x${string}`,
          event: swapCreatedEvent,
          args: {
            hashLock: hashLock as `0x${string}`,
          },
          fromBlock,
        });

        if (logs.length > 0) {
          const log = logs[0];
          console.log("Detected Polygon HTLC:", log);
          setStatus("detected");
          onHTLCDetected(log.args.swapId as string);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("Error polling Polygon:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Unknown error",
        );
        setStatus("error");
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [hashLock, onHTLCDetected]);

  return (
    <div className="space-y-2">
      {status === "waiting" && (
        <div className="text-sm text-muted-foreground">
          ⏳ Waiting for lendaswap to fund Polygon HTLC...
          <p className="text-xs mt-1">
            (This happens automatically after you fund the Bitcoin side)
          </p>
        </div>
      )}
      {status === "detected" && (
        <div className="text-sm text-green-600 font-medium">
          ✓ Polygon HTLC detected! Ready to claim your USDC.
        </div>
      )}
      {status === "error" && errorMessage && (
        <div className="text-sm text-red-600">
          ⚠ Error monitoring Polygon: {errorMessage}
        </div>
      )}
    </div>
  );
}
