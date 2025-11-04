import { decode } from "@gandlaf21/bolt11-decode";
import { ConnectKitButton } from "connectkit";
import { isAddress } from "ethers";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import type { TokenId } from "../api";

// import {decode} from "bolt11";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  targetToken: TokenId;
  className?: string;
  setAddressIsValid: (valid: boolean) => void;
}

export function AddressInput({
  value,
  onChange,
  targetToken,
  className = "",
  setAddressIsValid,
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

        for (const sectionsKey in bolt11Invoice.sections) {
          const section = bolt11Invoice.sections[sectionsKey];
          if (section.name === "amount" && section.value) {
            const amount = Number.parseInt(section.value);
            if (amount > 0) {
              setValidationError(
                "Invoice cannot have an amount. Please provide a different invoice.",
              );
              setAddressIsValid(false);
            }
          }
        }
      } catch (e) {
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
  }, [value, targetToken, isPolygonTarget]);

  const getPlaceholder = () => {
    switch (targetToken) {
      case "btc_lightning":
        return "Provide a bolt11 invoice without amount";
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
      <label className="text-sm text-muted-foreground">
        {`Where would you like to receive the funds?`}
      </label>
      <div className="relative">
        <Input
          type="text"
          placeholder={getPlaceholder()}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`px-4 py-3 min-h-[4.25rem] bg-white border-2 rounded-lg hover:border-blue-300 transition-colors shadow-sm font-mono text-sm ${
            isPolygonTarget ? "pr-40" : ""
          } ${className}`}
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
                  >
                    Connect Wallet
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
