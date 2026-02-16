import { decode } from "@gandlaf21/bolt11-decode";
import {
  isArkade,
  isEvmToken,
  isLightning,
  type TokenInfo,
} from "@lendasat/lendaswap-sdk-pure";
import { ConnectKitButton } from "connectkit";
import { isAddress } from "ethers";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  isBolt11Invoice,
  isLightningAddress,
} from "../../utils/lightningAddress";
import { isValidSpeedWalletContext } from "../../utils/speedWallet";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  targetToken?: TokenInfo;
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
  const isEvmTarget = targetToken ? isEvmToken(targetToken.chain) : false;
  const { address, isConnected } = useAccount();
  const [validationError, setValidationError] = useState<string>("");
  const isSpeedWallet = isValidSpeedWalletContext();

  useEffect(() => {
    if (!value || !targetToken) {
      setValidationError("");
      return;
    }

    setAddressIsValid(true);
    console.log(
      `isArkade(targetToken) ${isArkade(targetToken)} ${JSON.stringify(targetToken)}`,
    );

    if (isEvmTarget) {
      if (!isAddress(value)) {
        setValidationError("Invalid Ethereum/Polygon address");
        setAddressIsValid(false);
      } else {
        setValidationError("");
      }
    } else if (isLightning(targetToken)) {
      // Accept both Lightning addresses and BOLT11 invoices
      if (isLightningAddress(value)) {
        // Valid Lightning address (will be resolved to invoice later)
        setValidationError("");
        setAddressIsValid(true);
      } else if (isBolt11Invoice(value)) {
        // Valid BOLT11 invoice - decode and validate amount
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
      } else {
        setValidationError("Invalid BOLT11 invoice. Expected format: lnbc...");
        setAddressIsValid(false);
      }
    } else if (isArkade(targetToken)) {
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
  }, [value, targetToken, isEvmTarget, setAddressIsValid, setBitcoinAmount]);

  const getPlaceholder = () => {
    switch (targetToken?.chain) {
      case "Lightning":
        return "BOLT11 invoice or Lightning address (LNURL)";
      case "Arkade":
        return "Provide an Arkade address";
      case "Polygon":
        return "Provide a Polygon address";
      case "Ethereum":
        return "Provide a Ethereum address";
      case "Arbitrum":
        return "Provide a Arbitrum address";
      case "Bitcoin":
        return "Provide a Bitcoin address";
    }
  };

  return (
    <div className="rounded-2xl bg-muted p-4">
      <div className="text-sm text-muted-foreground mb-2">Receive address</div>
      <div className="relative">
        <Input
          type="text"
          placeholder={getPlaceholder()}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`px-3 py-2 min-h-[2.75rem] bg-background border-0 rounded-xl text-sm font-mono placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-ring ${
            isEvmTarget ? "pr-28" : ""
          } ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}
          data-1p-ignore
          data-lpignore="true"
          autoComplete="off"
        />

        {/* Get Address Button - Only for EVM addresses, hidden in Speed Wallet */}
        {isEvmTarget && !isSpeedWallet && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            {isConnected && !value ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (address) {
                    onChange(address);
                  }
                }}
                type="button"
                className="h-7 text-xs px-2"
              >
                Use wallet
              </Button>
            ) : !isConnected ? (
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={show}
                    type="button"
                    className="h-7 text-xs px-2"
                  >
                    <Wallet className="w-3 h-3 mr-1" />
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
        <p className="text-destructive text-xs mt-2">{validationError}</p>
      )}
    </div>
  );
}
