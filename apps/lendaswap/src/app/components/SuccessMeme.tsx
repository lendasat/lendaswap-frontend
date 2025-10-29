import {useEffect, useState} from "react";
import {GiphyFetch} from "@giphy/js-fetch-api";
import {Gif} from "@giphy/react-components";
import type {IGif} from "@giphy/js-types";
import {Button} from "#/components/ui/button";
import {Share2} from "lucide-react";

const gf = new GiphyFetch(import.meta.env.VITE_GIPHY_API_KEY);

interface SuccessMemeProps {
    swapDurationSeconds: number | null;
    usdcAmount: string;
}

export function SuccessMeme({
                                swapDurationSeconds,
                                usdcAmount,
                            }: SuccessMemeProps) {
    const [gif, setGif] = useState<IGif | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRandomGif = async () => {
            try {
                setIsLoading(true);
                const {data} = await gf.random({tag: "success celebration"});
                setGif(data);
            } catch (error) {
                console.error("Failed to fetch Giphy:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRandomGif();
    }, []);

    const handleShareOnX = () => {
        const durationText = swapDurationSeconds
            ? `${swapDurationSeconds} seconds`
            : "under 30 seconds";

        const tweetText = `Just swapped Lightning Bitcoin to USDC in ${durationText}! ⚡

$${usdcAmount} USDC landed on Polygon. No CEX, no KYC needed.

Atomic swap powered by @arkade_os

Built by @LendaSat → https://swap.lendasat.com`;

        // Twitter Intent - Note: Can't embed GIF directly via intent API
        // Would require Twitter media upload API with authentication
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

        window.open(shareUrl, "_blank", "width=550,height=420");
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center gap-4">
                <div className="bg-muted h-48 w-full max-w-md animate-pulse rounded-lg"/>
            </div>
        );
    }

    if (!gif) {
        return null;
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="w-full max-w-sm overflow-hidden rounded-lg shadow-lg md:max-w-md">
                <Gif gif={gif} width={400} hideAttribution={false}/>
            </div>
            <div className="space-y-1 text-center">
                <p className="text-sm font-semibold uppercase tracking-wide">
                    Limited time offer: Get no fees by reposting on 𝕏
                </p>
                <p className="text-muted-foreground text-xs">
                    (we'll send you a DM with your individual browser code)
                </p>
            </div>
            <Button
                onClick={handleShareOnX}
                size="lg"
                className="gap-2 text-base font-semibold"
            >
                <Share2 className="h-5 w-5"/>
                Share on 𝕏
            </Button>
            <p className="text-muted-foreground text-xs">
                Powered by{" "}
                <a
                    href="https://giphy.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                >
                    GIPHY
                </a>
            </p>
        </div>
    );
}
