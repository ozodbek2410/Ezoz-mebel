import { trpc } from "@/lib/trpc";
import { formatUzs, formatUsd } from "@ezoz/shared";
import { getT } from "@/hooks/useT";

interface ReceiptSaleDetail {
  documentNo: string;
  createdAt: string | Date;
  totalUzs: string | number;
  totalUsd: string | number;
  customer: { fullName: string } | null;
  cashier: { fullName: string };
  items: Array<{
    product?: { name: string } | null;
    serviceName?: string | null;
    quantity: string | number;
    priceUzs: string | number;
    totalUzs: string | number;
  }>;
  payments: Array<{
    paymentType: string;
    amountUzs: string | number;
  }>;
}

interface CompanyInfo {
  name?: string;
  address?: string;
  phone?: string;
}

function buildReceiptHtml(
  sale: ReceiptSaleDetail,
  company: CompanyInfo,
  printerSize: "80mm" | "58mm",
): string {
  const t = getT();
  const width = printerSize === "58mm" ? "54mm" : "72mm";
  const fontSize = printerSize === "58mm" ? "10px" : "12px";
  const smallFont = printerSize === "58mm" ? "9px" : "10px";

  const itemsHtml = sale.items
    .map((item) => {
      const name = item.product?.name || item.serviceName || "-";
      const qty = String(item.quantity);
      const price = formatUzs(Number(item.priceUzs));
      const total = formatUzs(Number(item.totalUzs));
      return `
        <div style="margin-bottom:3px;">
          <div style="font-weight:600;">${name}</div>
          <div class="row" style="font-size:${smallFont};">
            <span>${qty} x ${price}</span>
            <span style="font-weight:700;">${total}</span>
          </div>
        </div>`;
    })
    .join("");

  const paymentsHtml = sale.payments.length > 0
    ? `<div class="divider"></div>${sale.payments
        .map(
          (p) =>
            `<div class="row" style="font-size:${smallFont};"><span>${p.paymentType === "CASH_UZS" ? t("Naqd") : p.paymentType === "CARD" ? t("Karta") : p.paymentType}</span><span>${formatUzs(Number(p.amountUzs))}</span></div>`,
        )
        .join("")}`
    : "";

  const usdLine =
    Number(sale.totalUsd) > 0
      ? `<div class="row" style="font-size:${smallFont};"><span>USD:</span><span>${formatUsd(Number(sale.totalUsd))}</span></div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: ${printerSize} auto; margin: 2mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Courier New", monospace;
    font-size: ${fontSize};
    width: ${width};
    margin: 0 auto;
    padding: 2mm 0;
    color: #000;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 4px; }
  .total-row { display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; }
</style>
</head>
<body>
  <div class="center" style="margin-bottom:4px;">
    <div style="font-size:14px;font-weight:700;">${company.name || "EZOZ MEBEL"}</div>
    ${company.address ? `<div>${company.address}</div>` : ""}
    ${company.phone ? `<div>Tel: ${company.phone}</div>` : ""}
  </div>
  <div class="divider"></div>
  <div style="margin:3px 0;">
    <div class="row"><span>${t("Chek")}:</span><span class="bold">${sale.documentNo}</span></div>
    <div class="row"><span>${t("Sana")}:</span><span>${new Date(sale.createdAt).toLocaleString("uz")}</span></div>
    ${sale.customer ? `<div class="row"><span>${t("Mijoz")}:</span><span>${sale.customer.fullName}</span></div>` : ""}
    <div class="row"><span>${t("Kassir")}:</span><span>${sale.cashier.fullName}</span></div>
  </div>
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  <div class="total-row">
    <span>${t("JAMI")}:</span>
    <span>${formatUzs(Number(sale.totalUzs))}</span>
  </div>
  ${usdLine}
  ${paymentsHtml}
  <div class="divider"></div>
  <div class="center" style="font-size:${smallFont};color:#666;margin-top:4px;">
    ${t("Xaridingiz uchun rahmat!")}
  </div>
</body>
</html>`;
}

/**
 * Print receipt using hidden iframe (avoids popup blocker).
 */
function printViaIframe(html: string): void {
  const id = "receipt-print-frame";
  let iframe = document.getElementById(id) as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = id;
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content to render, then print
  setTimeout(() => {
    iframe!.contentWindow?.print();
  }, 200);
}

/**
 * Print receipt for a completed sale.
 * Uses iframe to avoid popup blocker issues in async callbacks.
 */
export function printReceiptHtml(
  sale: ReceiptSaleDetail,
  company: CompanyInfo = {},
  printerSize: "80mm" | "58mm" = "80mm",
): void {
  const html = buildReceiptHtml(sale, company, printerSize);
  printViaIframe(html);
}

/**
 * Fetch sale details and print receipt automatically.
 * Used after sale completion in POS.
 */
export async function fetchAndPrintReceipt(saleId: number): Promise<void> {
  try {
    const [sale, company] = await Promise.all([
      trpc.sale.getById.query({ id: saleId }),
      trpc.settings.getCompanyInfo.query(),
    ]);
    printReceiptHtml(sale, company);
  } catch {
    // Silent fail — don't block POS workflow
  }
}
