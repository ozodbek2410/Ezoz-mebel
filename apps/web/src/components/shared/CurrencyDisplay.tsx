import { formatUzs, formatUsd } from "@ezoz/shared";

interface CurrencyDisplayProps {
  amountUzs: number | string;
  amountUsd: number | string;
  showBoth?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "neutral";
}

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function CurrencyDisplay({ amountUzs, amountUsd, showBoth = true, size = "md", variant = "default" }: CurrencyDisplayProps) {
  const uzs = Number(amountUzs);
  const usd = Number(amountUsd);

  const uzsClass = variant === "neutral" ? "font-semibold text-slate-800 whitespace-nowrap" : "currency-uzs whitespace-nowrap";
  const usdClass = variant === "neutral" ? "text-xs text-slate-500 whitespace-nowrap" : "currency-usd text-xs";

  return (
    <div className={`flex flex-col ${sizeClasses[size]}`}>
      <span className={uzsClass}>{formatUzs(uzs)}</span>
      {showBoth && usd > 0 && (
        <span className={usdClass}>{formatUsd(usd)}</span>
      )}
    </div>
  );
}
