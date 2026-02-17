import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { useCopyToClipboard } from "./useCopyToClipboard";

interface QrCodeSectionProps {
  value: string;
}

export function QrCodeSection({ value }: QrCodeSectionProps) {
  const [showQrCode, setShowQrCode] = useState(false);
  const { copiedValue, handleCopy } = useCopyToClipboard();

  return (
    <>
      {/* Toggle button - only visible on mobile */}
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
        <button
          type="button"
          onClick={() => handleCopy(value)}
          className="rounded-lg bg-white p-1 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <QRCodeSVG value={value} size={200} level="M" />
        </button>
        {copiedValue === value && (
          <span className="text-xs text-muted-foreground">Copied!</span>
        )}
      </div>
    </>
  );
}
