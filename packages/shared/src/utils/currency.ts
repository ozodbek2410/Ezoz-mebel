export function convertToUzs(amountUsd: number, rate: number): number {
  return Math.round(amountUsd * rate);
}

export function convertToUsd(amountUzs: number, rate: number): number {
  return Math.round((amountUzs / rate) * 100) / 100;
}

export function formatUzs(amount: number): string {
  const formatted = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return formatted + " so'm";
}

export function formatNumber(value: number | string): string {
  const num = String(value).replace(/[^\d]/g, "");
  if (!num) return "";
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function parseFormattedNumber(value: string): number {
  return Number(value.replace(/\s/g, "")) || 0;
}

export function formatUsd(amount: number): string {
  return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
