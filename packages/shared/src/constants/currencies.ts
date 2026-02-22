export const Currency = {
  UZS: "UZS",
  USD: "USD",
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];

export const CurrencyLabels: Record<Currency, string> = {
  UZS: "so'm",
  USD: "$",
};

export const CurrencyColors: Record<Currency, string> = {
  UZS: "text-red-600",
  USD: "text-blue-600",
};
