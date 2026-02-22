import { useRef } from "react";
import { CurrencyInput } from "./CurrencyInput";
import { useCurrencyStore } from "@/store/currency.store";
import { convertToUzs, convertToUsd } from "@ezoz/shared";

interface CurrencyPairInputProps {
  label?: string;
  valueUzs: string;
  valueUsd: string;
  onChangeUzs: (value: string) => void;
  onChangeUsd: (value: string) => void;
}

export function CurrencyPairInput({
  label,
  valueUzs,
  valueUsd,
  onChangeUzs,
  onChangeUsd,
}: CurrencyPairInputProps) {
  const rate = useCurrencyStore((s) => s.rate);
  // Track which field is being edited to avoid circular updates
  const editingRef = useRef<"uzs" | "usd" | null>(null);

  function handleUzsChange(val: string) {
    editingRef.current = "uzs";
    onChangeUzs(val);
    if (rate && val && Number(val) > 0) {
      onChangeUsd(String(convertToUsd(Number(val), rate)));
    }
    editingRef.current = null;
  }

  function handleUsdChange(val: string) {
    editingRef.current = "usd";
    onChangeUsd(val);
    if (rate && val && Number(val) > 0) {
      onChangeUzs(String(convertToUzs(Number(val), rate)));
    }
    editingRef.current = null;
  }

  return (
    <div>
      {label && <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>}
      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput
          currency="UZS"
          value={valueUzs}
          onValueChange={handleUzsChange}
        />
        <CurrencyInput
          currency="USD"
          value={valueUsd}
          onValueChange={handleUsdChange}
        />
      </div>
    </div>
  );
}
