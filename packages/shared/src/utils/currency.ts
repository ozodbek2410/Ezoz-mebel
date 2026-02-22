export function convertToUzs(amountUsd: number, rate: number): number {
  return Math.round(amountUsd * rate);
}

export function convertToUsd(amountUzs: number, rate: number): number {
  return Math.round((amountUzs / rate) * 100) / 100;
}

export function formatUzs(amount: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(amount)) + " so'm";
}

export function formatUsd(amount: number): string {
  return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
