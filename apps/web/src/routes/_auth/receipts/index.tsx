import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput, Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading, Badge, Modal, Button, Select } from "@/components/ui";
import { CurrencyDisplay } from "@/components/shared";
import { formatUzs, formatUsd } from "@ezoz/shared";

export function ReceiptsPage() {
  const [search, setSearch] = useState("");
  const [previewSaleId, setPreviewSaleId] = useState<number | null>(null);
  const [printerSize, setPrinterSize] = useState("80mm");
  const printRef = useRef<HTMLDivElement>(null);

  const salesQuery = useQuery({
    queryKey: ["sale", "list-receipts"],
    queryFn: () => trpc.sale.list.query({ status: "COMPLETED" }),
  });

  const saleDetail = useQuery({
    queryKey: ["sale", "detail", previewSaleId],
    queryFn: () => trpc.sale.getById.query({ id: previewSaleId! }),
    enabled: previewSaleId !== null,
  });

  const companyInfo = useQuery({
    queryKey: ["settings", "companyInfo"],
    queryFn: () => trpc.settings.getCompanyInfo.query(),
  });

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const width = printerSize === "58mm" ? "54mm" : "76mm";
    printWindow.document.write(`<html><head><style>
      @page { size: ${printerSize} auto; margin: 2mm; }
      body { font-family: "Courier New", monospace; font-size: 11px; width: ${width}; margin: 0; padding: 0; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .divider { border-top: 1px dashed #000; margin: 4px 0; }
      .row { display: flex; justify-content: space-between; }
    </style></head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  const sales = salesQuery.data?.sales ?? [];
  const filtered = search
    ? sales.filter((s) =>
        s.documentNo.toLowerCase().includes(search.toLowerCase()) ||
        s.customer?.fullName.toLowerCase().includes(search.toLowerCase()),
      )
    : sales;

  const detail = saleDetail.data;
  const company = companyInfo.data ?? {};

  return (
    <>
      <PageHeader title="Cheklar" subtitle={`${filtered.length} ta chek`} />

      <div className="page-body">
        <div className="mb-4">
          <SearchInput
            placeholder="Hujjat raqami yoki mijoz nomi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>

        <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <tr>
              <th>Hujjat</th>
              <th className="hidden sm:table-cell">Sana</th>
              <th className="hidden md:table-cell">Mijoz</th>
              <th className="hidden sm:table-cell">Turi</th>
              <th>Summa</th>
              <th className="w-20">Chop etish</th>
            </tr>
          </TableHead>
          <TableBody>
            {salesQuery.isLoading ? (
              <TableLoading colSpan={6} />
            ) : filtered.length === 0 ? (
              <TableEmpty colSpan={6} message="Cheklar topilmadi" />
            ) : (
              filtered.map((sale) => (
                <TableRow key={sale.id}>
                  <td className="font-mono text-xs">{sale.documentNo}</td>
                  <td className="text-sm text-gray-500 hidden sm:table-cell">
                    {new Date(sale.createdAt).toLocaleDateString("uz")}
                  </td>
                  <td className="hidden md:table-cell">{sale.customer?.fullName || "-"}</td>
                  <td className="hidden sm:table-cell">
                    <Badge variant={sale.saleType === "PRODUCT" ? "info" : "warning"}>
                      {sale.saleType === "PRODUCT" ? "Savdo" : "Xizmat"}
                    </Badge>
                  </td>
                  <td>
                    <CurrencyDisplay amountUzs={sale.totalUzs} amountUsd={sale.totalUsd} size="sm" />
                  </td>
                  <td>
                    <button
                      className="p-1.5 hover:bg-gray-100 rounded-lg"
                      onClick={() => setPreviewSaleId(sale.id)}
                    >
                      <Printer className="w-4 h-4 text-gray-500" />
                    </button>
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Receipt Preview Modal */}
      <Modal
        open={previewSaleId !== null}
        onClose={() => setPreviewSaleId(null)}
        title="Chek ko'rish"
        size="sm"
        footer={
          <div className="flex items-center justify-between w-full">
            <Select
              options={[
                { value: "80mm", label: "80mm" },
                { value: "58mm", label: "58mm" },
              ]}
              value={printerSize}
              onChange={(e) => setPrinterSize(e.target.value)}
            />
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Chop etish
            </Button>
          </div>
        }
      >
        {detail && (
          <div ref={printRef} className="font-mono text-xs p-4 bg-white border rounded-lg max-w-[300px] mx-auto">
            <div className="text-center mb-3">
              <p className="text-sm font-bold">{company["name"] || "EZOZ MEBEL"}</p>
              {company["address"] && <p>{company["address"]}</p>}
              {company["phone"] && <p>Tel: {company["phone"]}</p>}
              <div className="border-t border-dashed border-gray-400 my-2" />
            </div>

            <div className="mb-2 space-y-0.5">
              <div className="flex justify-between"><span>Chek:</span><span className="font-bold">{detail.documentNo}</span></div>
              <div className="flex justify-between"><span>Sana:</span><span>{new Date(detail.createdAt).toLocaleString("uz")}</span></div>
              {detail.customer && <div className="flex justify-between"><span>Mijoz:</span><span>{detail.customer.fullName}</span></div>}
              <div className="flex justify-between"><span>Kassir:</span><span>{detail.cashier.fullName}</span></div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            <div className="space-y-1.5">
              {detail.items.map((item, idx) => (
                <div key={idx}>
                  <p className="font-medium">{item.product?.name || item.serviceName || "-"}</p>
                  <div className="flex justify-between" style={{ fontSize: "10px" }}>
                    <span>{String(item.quantity)} x {formatUzs(Number(item.priceUzs))}</span>
                    <span className="font-bold">{formatUzs(Number(item.totalUzs))}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            <div className="flex justify-between text-sm font-bold">
              <span>JAMI:</span>
              <span>{formatUzs(Number(detail.totalUzs))}</span>
            </div>
            {Number(detail.totalUsd) > 0 && (
              <div className="flex justify-between" style={{ fontSize: "10px" }}>
                <span>USD:</span>
                <span>{formatUsd(Number(detail.totalUsd))}</span>
              </div>
            )}

            {detail.payments.length > 0 && (
              <>
                <div className="border-t border-dashed border-gray-400 my-2" />
                {detail.payments.map((p, idx) => (
                  <div key={idx} className="flex justify-between" style={{ fontSize: "10px" }}>
                    <span>{p.paymentType}</span>
                    <span>{formatUzs(Number(p.amountUzs))}</span>
                  </div>
                ))}
              </>
            )}

            <div className="border-t border-dashed border-gray-400 my-2" />
            <p className="text-center text-gray-500" style={{ fontSize: "10px" }}>Xaridingiz uchun rahmat!</p>
          </div>
        )}
      </Modal>
    </>
  );
}