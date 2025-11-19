import { GiphyFetch } from "@giphy/js-fetch-api";
import type { IGif } from "@giphy/js-types";
import { Gif } from "@giphy/react-components";
import { useEffect, useState } from "react";

const gf = new GiphyFetch(import.meta.env.VITE_GIPHY_API_KEY);

export function SuccessMeme() {
  const [gif, setGif] = useState<IGif | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRandomGif = async () => {
      try {
        setIsLoading(true);
        const { data } = await gf.random({ tag: "success celebration" });
        setGif(data);
      } catch (error) {
        console.error("Failed to fetch Giphy:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRandomGif();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="bg-muted h-48 w-full max-w-md animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!gif) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-sm overflow-hidden rounded-lg shadow-lg md:max-w-md">
        <Gif gif={gif} width={400} hideAttribution={false} />
      </div>
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
