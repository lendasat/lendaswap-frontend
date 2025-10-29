import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "#/components/ui/card";
import { Button } from "#/components/ui/button";
import { Alert, AlertDescription } from "#/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { Copy, Check } from "lucide-react";

interface SwapData {
  secret: string;
  own_sk: string;
  lendaswap_pk: string;
  arkade_server_pk: string;
  refund_locktime: number;
  unilateral_claim_delay: number;
  unilateral_refund_delay: number;
  unilateral_refund_without_receiver_delay: number;
  network: string;
  vhtlc_address: string;
}

interface StoredSwap {
  id: string;
  data: SwapData;
}

export function SwapsPage() {
  const [swaps, setSwaps] = useState<StoredSwap[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCopyId = async (swapId: string) => {
    try {
      await navigator.clipboard.writeText(swapId);
      setCopiedId(swapId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy swap ID:", error);
    }
  };

  // Load all swaps from localStorage
  useEffect(() => {
    const loadSwaps = () => {
      const swapList: StoredSwap[] = [];

      // Iterate through all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // Skip non-UUID keys (like referral code, global private key, etc.)
        if (
          !key.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          )
        ) {
          continue;
        }

        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            // Check if this is a swap with the new format (has own_sk, etc.)
            if (parsed.own_sk && parsed.vhtlc_address) {
              swapList.push({ id: key, data: parsed });
            }
          }
        } catch (error) {
          console.error(`Failed to parse swap data for ${key}:`, error);
        }
      }

      setSwaps(swapList);
    };

    loadSwaps();
  }, []);

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Swaps</CardTitle>
          <CardDescription>
            All swaps stored in your browser's local storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {swaps.length === 0 ? (
            <Alert>
              <AlertDescription>
                No swaps found in local storage. Create a swap first to see it
                here.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Swap ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {swaps.map((swap) => (
                    <TableRow key={swap.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <span>
                            {swap.id.slice(0, 8)}...{swap.id.slice(-8)}
                          </span>
                          <button
                            onClick={() => handleCopyId(swap.id)}
                            className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Copy full swap ID"
                          >
                            {copiedId === swap.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/manage/${swap.id}`)}
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
