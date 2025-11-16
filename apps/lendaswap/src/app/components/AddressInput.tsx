import { decode } from "@gandlaf21/bolt11-decode";
import { ConnectKitButton } from "connectkit";
import { isAddress } from "ethers";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import type { TokenId } from "../api";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  targetToken: TokenId;
  className?: string;
  setAddressIsValid: (valid: boolean) => void;
  setBitcoinAmount: (amount: number) => void;
  disabled?: boolean;
}

export function AddressInput({
  value,
  onChange,
  targetToken,
  className = "",
  setAddressIsValid,
  setBitcoinAmount,
  disabled = false,
}: AddressInputProps) {
  const isPolygonTarget =
    targetToken === "usdc_pol" || targetToken === "usdt_pol";
  const { address, isConnected } = useAccount();
  const [validationError, setValidationError] = useState<string>("");

  useEffect(() => {
    if (!value) {
      setValidationError("");
      return;
    }

    setAddressIsValid(true);

    if (isPolygonTarget) {
      if (!isAddress(value)) {
        setValidationError("Invalid Ethereum/Polygon address");
        setAddressIsValid(false);
      } else {
        setValidationError("");
      }
    } else if (targetToken === "btc_lightning") {
      try {
        setValidationError("");
        const bolt11Invoice = decode(value);
        let hasAmount = false;
        for (const sectionsKey in bolt11Invoice.sections) {
          const section = bolt11Invoice.sections[sectionsKey];
          if (section.name === "amount" && section.value) {
            const amount = Number.parseInt(section.value, 10);
            if (amount > 0) {
              setAddressIsValid(true);
              hasAmount = true;
              setBitcoinAmount(amount / 1_000 / 100_000_000);
            }
          }
        }
        if (!hasAmount) {
          setAddressIsValid(true);
          setValidationError("Invoices without amount are not supported.");
        }
      } catch (_e) {
        setValidationError("Invalid Lightning invoice");
        setAddressIsValid(false);
      }
    } else if (targetToken === "btc_arkade") {
      // Basic Arkade address validation (starts with ark1)
      if (
        !value.toLowerCase().startsWith("ark1") &&
        !value.toLowerCase().startsWith("tark1")
      ) {
        setValidationError("Invalid Arkade address (must start with 'ark1')");
        setAddressIsValid(false);
      } else {
        setValidationError("");
      }
    }
  }, [
    value,
    targetToken,
    isPolygonTarget,
    setAddressIsValid,
    setBitcoinAmount,
  ]);

  const getPlaceholder = () => {
    switch (targetToken) {
      case "btc_lightning":
        return "Provide a bolt11 invoice with amount";
      case "btc_arkade":
        return "Provide an Arkade address";
      case "usdc_pol":
        return "Provide a USDC address on Polygon";
      case "usdt_pol":
        return "Provide a USDT0 address on Polygon";
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        {`Where would you like to receive the funds?`}
      </div>
      <div className="relative">
        <Input
          type="text"
          placeholder={getPlaceholder()}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`px-4 py-2 md:py-2.5 min-h-[3rem] md:min-h-[3.5rem] bg-card border-2 rounded-lg hover:border-blue-300 transition-colors shadow-sm font-mono text-sm ${
            isPolygonTarget ? "pr-36 md:pr-40" : ""
          } ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}
          data-1p-ignore
          data-lpignore="true"
          autoComplete="off"
        />

        {/* Get Address Button - Only for Polygon addresses */}
        {isPolygonTarget && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {isConnected && !value ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  if (address) {
                    onChange(address);
                  }
                }}
                type="button"
              >
                Get Address
              </Button>
            ) : !isConnected ? (
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={show}
                    type="button"
                    className="h-8 text-xs md:h-9 md:text-sm px-2 md:px-3"
                  >
                    <Wallet className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1 md:mr-1.5" />
                    Connect
                  </Button>
                )}
              </ConnectKitButton.Custom>
            ) : null}
          </div>
        )}
      </div>

      {/* Address Error Display */}
      {validationError && (
        <p className="text-destructive text-xs">{validationError}</p>
      )}
    </div>
  );
}
