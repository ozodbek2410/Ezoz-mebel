import { formatUzs, formatUsd } from "@ezoz/shared";

interface CurrencyDisplayProps {
  amountUzs: number | string;
  amountUsd: number | string;
  showBoth?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function CurrencyDisplay({ amountUzs, amountUsd, showBoth = true, size = "md" }: CurrencyDisplayProps) {
  const uzs = Number(amountUzs);
  const usd = Number(amountUsd);

  return (
    <div className={`flex flex-col ${sizeClasses[size]}`}>
      <span className="currency-uzs">{formatUzs(uzs)}</span>
      {showBoth && usd > 0 && (
        <span className="currency-usd text-xs">{formatUsd(usd)}</span>
      )}
    </div>
  );
}
