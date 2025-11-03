import { Input } from "#/components/ui/input";

interface UsdInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function UsdInput({
  value,
  onChange,
  placeholder = "0.00",
  className = "",
  id,
  disabled = false,
}: UsdInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Allow empty string (user can delete everything)
    if (input === "") {
      onChange("");
      return;
    }

    // Allow single decimal point at the end (for typing flow)
    if (input === ".") {
      onChange("0.");
      return;
    }

    // Validate USD format: optional digits, optional decimal point, up to 2 decimal places
    const usdRegex = /^\d*\.?\d{0,2}$/;

    if (usdRegex.test(input)) {
      onChange(input);
    }
    // If input doesn't match, don't update (ignore the invalid character)
  };

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      className={className}
      disabled={disabled}
      data-1p-ignore
      data-lpignore="true"
      autoComplete="off"
    />
  );
}
