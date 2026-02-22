import { type InputHTMLAttributes, forwardRef, useCallback } from "react";

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  label?: string;
  error?: string;
  currency?: "UZS" | "USD";
  value: string | number;
  onValueChange: (value: string) => void;
}

function formatNumber(val: string): string {
  const cleaned = val.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const integer = parts[0] || "";
  const decimal = parts.length > 1 ? `.${parts[1]?.slice(0, 2) ?? ""}` : "";
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return formatted + decimal;
}

function parseNumber(val: string): string {
  return val.replace(/\s/g, "");
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ label, error, currency = "UZS", value, onValueChange, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;
    const isUzs = currency === "UZS";

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = parseNumber(e.target.value);
        if (raw === "" || /^\d*\.?\d{0,2}$/.test(raw)) {
          onValueChange(raw);
        }
      },
      [onValueChange],
    );

    return (
      <div className="input-group">
        {label && (
          <label htmlFor={inputId} className="input-label">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            value={formatNumber(String(value))}
            onChange={handleChange}
            className={`input-field pr-16 ${error ? "border-red-500" : ""} ${className}`}
            {...props}
          />
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isUzs ? "text-uzs" : "text-usd"}`}
          >
            {currency === "UZS" ? "so'm" : "USD"}
          </span>
        </div>
        {error && <p className="input-error">{error}</p>}
      </div>
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";
