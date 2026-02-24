import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Warehouse,
  ArrowRightLeft,
  AlertTriangle,
  Package,
  PackageMinus,
  PackagePlus,
  ClipboardCheck,
  RotateCcw,
  PackageCheck,
  Plus,
  Trash2,
  Eye,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button,
  SearchInput,
  Modal,
  Input,
  Select,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableEmpty,
  TableLoading,
  Badge,
  Tabs,
  PhoneInput,
} from "@/components/ui";
import { CurrencyDisplay } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { useT, getT } from "@/hooks/useT";
import { formatUzs, convertToUzs, convertToUsd } from "@ezoz/shared";
import { useCurrencyStore } from "@/store/currency.store";
import toast from "react-hot-toast";

export function WarehousePage() {
  const { isBoss, can } = useAuth();
  const t = useT();
  const [activeTab, setActiveTab] = useState("stock");

  return (
    <>
      <PageHeader title={t("Ombor")} />

      <div className="page-body">
        <Tabs
          tabs={[
            { id: "stock", label: t("Qoldiqlar") },
            { id: "purchase", label: t("Kirim") },
            { id: "transfer", label: t("Ko'chirish") },
            ...(can("warehouse:write_off") ? [{ id: "writeoff", label: t("Chiqim") }] : []),
            ...(can("warehouse:return") ? [{ id: "return", label: t("Qaytarish") }] : []),
            ...(can("warehouse:inventory") ? [{ id: "inventory", label: t("Inventarizatsiya") }] : []),
            ...(can("warehouse:revalue") ? [{ id: "revalue", label: t("Qayta baholash") }] : []),
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="mt-6">
          {activeTab === "stock" && <StockTab />}
          {activeTab === "purchase" && <PurchaseTab />}
          {activeTab === "transfer" && <TransferTab />}
          {activeTab === "writeoff" && <WriteOffTab />}
          {activeTab === "return" && <ReturnTab />}
          {activeTab === "inventory" && <InventoryTab />}
          {activeTab === "revalue" && <RevalueTab />}
        </div>
      </div>
    </>
  );
}

// ===== Stock Tab =====
function StockTab() {
  const t = useT();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState("");

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
  });

  const stockQuery = useQuery({
    queryKey: ["warehouse", "stock", selectedWarehouse, lowStockOnly],
    queryFn: () =>
      trpc.warehouse.getStock.query({
        warehouseId: selectedWarehouse ? Number(selectedWarehouse) : undefined,
        lowStockOnly,
      }),
  });

  const stocks = stockQuery.data ?? [];
  const filtered = search
    ? stocks.filter(
        (s) =>
          s.product.name.toLowerCase().includes(search.toLowerCase()) ||
          s.product.code.toLowerCase().includes(search.toLowerCase()),
      )
    : stocks;

  const warehouseOptions = (warehousesQuery.data ?? []).map((w) => ({
    value: String(w.id),
    label: w.name,
  }));

  const lowStockCount = stocks.filter(
    (s) => Number(s.quantity) <= Number(s.product.minStockAlert) && Number(s.product.minStockAlert) > 0,
  ).length;

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="w-full sm:w-48">
          <Select
            options={[{ value: "", label: t("Barcha omborlar") }, ...warehouseOptions]}
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <SearchInput
            placeholder={t("Mahsulot qidirish...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t("Kam qoldiq")}
          </label>
          {lowStockCount > 0 && (
            <Badge variant="warning">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {lowStockCount}
            </Badge>
          )}
        </div>
      </div>

      <Table>
        <TableHead>
          <tr>
            <th>{t("Kod")}</th>
            <th>{t("Mahsulot")}</th>
            <th>{t("Guruh")}</th>
            <th>{t("Ombor")}</th>
            <th>{t("Qoldiq")}</th>
            <th>{t("Min")}</th>
            <th>{t("Narx")}</th>
          </tr>
        </TableHead>
        <TableBody>
          {stockQuery.isLoading ? (
            <TableLoading colSpan={7} />
          ) : filtered.length === 0 ? (
            <TableEmpty colSpan={7} message={t("Omborda mahsulot topilmadi")} />
          ) : (
            filtered.map((s) => {
              const qty = Number(s.quantity);
              const minAlert = Number(s.product.minStockAlert);
              const stockClass = qty <= 0 ? "stock-empty" : qty <= minAlert && minAlert > 0 ? "stock-low" : "stock-ok";

              return (
                <TableRow key={s.id}>
                  <td className="font-mono text-xs text-gray-500">{s.product.code}</td>
                  <td className="font-medium text-gray-900">{s.product.name}</td>
                  <td><Badge variant="neutral">{s.product.category.name}</Badge></td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Warehouse className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm">{s.warehouse.name}</span>
                    </div>
                  </td>
                  <td><span className={stockClass}>{qty} {s.product.unit}</span></td>
                  <td className="text-sm text-gray-500">{minAlert > 0 ? minAlert : "-"}</td>
                  <td><CurrencyDisplay amountUzs={s.product.sellPriceUzs} amountUsd={s.product.sellPriceUsd} size="sm" /></td>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </>
  );
}

// ===== Purchase Tab (Kirim) =====
interface PurchaseItemRow {
  productId: string;
  quantity: string;
  priceUzs: string;
  priceUsd: string;
}

const emptyItem: PurchaseItemRow = { productId: "", quantity: "", priceUzs: "", priceUsd: "" };

function PurchaseTab() {
  const queryClient = useQueryClient();
  const { isBoss, can } = useAuth();
  const t = useT();
  const rate = useCurrencyStore((s) => s.rate);
  const [mode, setMode] = useState<"list" | "create" | "detail">("list");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState<PurchaseItemRow[]>([{ ...emptyItem }]);
  const [notes, setNotes] = useState("");
  const [cashRegister, setCashRegister] = useState<"SALES" | "SERVICE">("SALES");
  const [paymentType, setPaymentType] = useState<"CASH_UZS" | "CASH_USD" | "CARD" | "TRANSFER">("CASH_UZS");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "", notes: "" });

  const purchasesQuery = useQuery({
    queryKey: ["warehouse", "purchases"],
    queryFn: () => trpc.warehouse.listPurchases.query(),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
  });

  const productsQuery = useQuery({
    queryKey: ["product", "list-purchase"],
    queryFn: () => trpc.product.list.query({ limit: 1000 }),
  });

  const suppliersQuery = useQuery({
    queryKey: ["supplier", "list"],
    queryFn: () => trpc.supplier.list.query(),
  });

  const purchaseDetailQuery = useQuery({
    queryKey: ["warehouse", "purchase", detailId],
    queryFn: () => trpc.warehouse.getPurchaseById.query({ id: detailId! }),
    enabled: detailId !== null,
  });

  const purchaseMutation = useMutation({
    mutationFn: () =>
      trpc.warehouse.purchase.mutate({
        supplierId: supplierId ? Number(supplierId) : undefined,
        warehouseId: Number(warehouseId),
        items: items
          .filter((i) => i.productId && i.quantity)
          .map((i) => ({
            productId: Number(i.productId),
            quantity: Number(i.quantity),
            priceUzs: Number(i.priceUzs) || 0,
            priceUsd: Number(i.priceUsd) || 0,
          })),
        notes: notes || undefined,
        cashRegister,
        paymentType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["expense"] });
      resetForm();
      setMode("list");
      toast.success(getT()("Kirim muvaffaqiyatli saqlandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const createSupplierMutation = useMutation({
    mutationFn: () =>
      trpc.supplier.create.mutate({
        name: newSupplier.name,
        phone: newSupplier.phone || undefined,
        notes: newSupplier.notes || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["supplier"] });
      setSupplierId(String(data.id));
      setNewSupplier({ name: "", phone: "", notes: "" });
      setShowSupplierModal(false);
      toast.success(getT()("Yetkazuvchi qo'shildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setSupplierId("");
    setWarehouseId("");
    setItems([{ ...emptyItem }]);
    setNotes("");
    setCashRegister("SALES");
    setPaymentType("CASH_UZS");
  }

  function updateItem(idx: number, field: keyof PurchaseItemRow, value: string) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (rate && value && Number(value) > 0) {
        if (field === "priceUzs") {
          updated.priceUsd = String(convertToUsd(Number(value), rate));
        } else if (field === "priceUsd") {
          updated.priceUzs = String(convertToUzs(Number(value), rate));
        }
      }
      return updated;
    }));
  }

  function addItemRow() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItemRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const warehouseOptions = (warehousesQuery.data ?? []).map((w) => ({ value: String(w.id), label: w.name }));
  const productOptions = (productsQuery.data?.items ?? []).map((p) => ({
    value: String(p.id),
    label: `${p.code} — ${p.name} (${p.unit})`,
  }));
  const supplierOptions = (suppliersQuery.data ?? []).map((s) => ({ value: String(s.id), label: s.name }));

  const validItems = items.filter((i) => i.productId && Number(i.quantity) > 0);

  // Detail view
  if (mode === "detail" && purchaseDetailQuery.data) {
    const p = purchaseDetailQuery.data;
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-semibold">{t("Kirim")} #{p.documentNo}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setMode("list"); setDetailId(null); }}>
            {t("Ortga")}
          </Button>
        </div>
        <div className="card card-body space-y-3 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">{t("Sana")}:</span>
              <p className="font-medium">{new Date(p.createdAt).toLocaleDateString("uz")}</p>
            </div>
            <div>
              <span className="text-gray-500">{t("Yetkazuvchi")}:</span>
              <p className="font-medium">{p.supplier?.name ?? t("Noma'lum")}</p>
            </div>
            <div>
              <span className="text-gray-500">{t("Jami UZS")}:</span>
              <p className="font-medium text-red-600">{formatUzs(Number(p.totalUzs))}</p>
            </div>
            <div>
              <span className="text-gray-500">{t("Jami USD")}:</span>
              <p className="font-medium text-blue-600">${Number(p.totalUsd).toLocaleString()}</p>
            </div>
          </div>
          {p.notes && <p className="text-sm text-gray-500">{t("Izoh")}: {p.notes}</p>}
        </div>
        <Table>
          <TableHead>
            <tr>
              <th>{t("Mahsulot")}</th>
              <th>{t("Miqdor")}</th>
              <th>{t("Narx (UZS)")}</th>
              <th>{t("Narx (USD)")}</th>
              <th>{t("Jami (UZS)")}</th>
            </tr>
          </TableHead>
          <TableBody>
            {p.items.map((item) => (
              <TableRow key={item.id}>
                <td className="font-medium">{item.product.name}</td>
                <td>{Number(item.quantity)}</td>
                <td className="text-red-600">{formatUzs(Number(item.priceUzs))}</td>
                <td className="text-blue-600">${Number(item.priceUsd).toLocaleString()}</td>
                <td className="font-semibold text-red-600">{formatUzs(Number(item.priceUzs) * Number(item.quantity))}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Create form
  if (mode === "create") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-semibold">{t("Yangi kirim")}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { resetForm(); setMode("list"); }}>
            {t("Bekor qilish")}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label={t("Yetkazuvchi")}
                  options={supplierOptions}
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  placeholder={t("Tanlang (ixtiyoriy)")}
                />
              </div>
              {(isBoss() || can("warehouse:purchase")) && (
                <Button variant="secondary" size="sm" className="mb-0.5" onClick={() => setShowSupplierModal(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Select
              label={t("Ombor")}
              options={warehouseOptions}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              placeholder={t("Ombor tanlang")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("Mahsulotlar")}</label>
            <Table>
              <TableHead>
                <tr>
                  <th className="w-[35%]">{t("Mahsulot")}</th>
                  <th className="w-[15%]">{t("Miqdor")}</th>
                  <th className="w-[20%]">{t("Narx (UZS)")}</th>
                  <th className="w-[20%]">{t("Narx (USD)")}</th>
                  <th className="w-[10%]"></th>
                </tr>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-1.5 px-2">
                      <select
                        className="input-field text-sm py-1.5"
                        value={item.productId}
                        onChange={(e) => updateItem(idx, "productId", e.target.value)}
                      >
                        <option value="">{t("Tanlang")}</option>
                        {productOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" className="input-field text-sm py-1.5 w-full" value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)} placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" className="input-field text-sm py-1.5 w-full" value={item.priceUzs}
                        onChange={(e) => updateItem(idx, "priceUzs", e.target.value)} placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" className="input-field text-sm py-1.5 w-full" value={item.priceUsd}
                        onChange={(e) => updateItem(idx, "priceUsd", e.target.value)} placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {items.length > 1 && (
                        <button onClick={() => removeItemRow(idx)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </TableBody>
            </Table>
            <Button variant="ghost" size="sm" className="mt-2" onClick={addItemRow}>
              <Plus className="w-4 h-4" />
              {t("Qator qo'shish")}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label={t("Kassa")}
              options={[
                { value: "SALES", label: t("Savdo kassasi") },
                { value: "SERVICE", label: t("Xizmat kassasi") },
              ]}
              value={cashRegister}
              onChange={(e) => setCashRegister(e.target.value as "SALES" | "SERVICE")}
            />
            <Select
              label={t("To'lov turi")}
              options={[
                { value: "CASH_UZS", label: t("Naqd (UZS)") },
                { value: "CASH_USD", label: t("Naqd (USD)") },
                { value: "CARD", label: t("Karta") },
                { value: "TRANSFER", label: t("O'tkazma") },
              ]}
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as "CASH_UZS" | "CASH_USD" | "CARD" | "TRANSFER")}
            />
            <Input label={t("Izoh")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Kirim izohi...")} />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-500">
              {validItems.length > 0 && (
                <span>
                  {validItems.length} {t("ta mahsulot")} | {t("Jami")}:{" "}
                  <span className="text-red-600 font-semibold">
                    {formatUzs(validItems.reduce((sum, i) => sum + (Number(i.priceUzs) || 0) * (Number(i.quantity) || 0), 0))}
                  </span>
                </span>
              )}
            </div>
            <Button
              loading={purchaseMutation.isPending}
              onClick={() => {
                if (!warehouseId) { toast.error(getT()("Ombor tanlang")); return; }
                if (validItems.length === 0) { toast.error(getT()("Kamida bitta mahsulot qo'shing")); return; }
                purchaseMutation.mutate();
              }}
            >
              <PackageCheck className="w-4 h-4" />
              {t("Saqlash")}
            </Button>
          </div>
        </div>

        {/* New supplier modal */}
        <Modal open={showSupplierModal} onClose={() => setShowSupplierModal(false)} title={t("Yangi yetkazuvchi")}>
          <div className="space-y-4">
            <Input label={t("Ism / Kompaniya")} value={newSupplier.name}
              onChange={(e) => setNewSupplier((f) => ({ ...f, name: e.target.value }))} />
            <PhoneInput label={t("Telefon")} value={newSupplier.phone}
              onChange={(v) => setNewSupplier((f) => ({ ...f, phone: v }))} />
            <Input label={t("Izoh")} value={newSupplier.notes}
              onChange={(e) => setNewSupplier((f) => ({ ...f, notes: e.target.value }))} />
            <Button loading={createSupplierMutation.isPending} onClick={() => {
              if (!newSupplier.name.trim()) { toast.error(getT()("Ism kiriting")); return; }
              createSupplierMutation.mutate();
            }}>
              {t("Saqlash")}
            </Button>
          </div>
        </Modal>
      </div>
    );
  }

  // List view (default)
  const purchases = purchasesQuery.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PackageCheck className="w-5 h-5 text-brand-600" />
          <h3 className="text-base font-semibold">{t("Kirimlar ro'yxati")}</h3>
        </div>
        <Button size="sm" onClick={() => setMode("create")}>
          <Plus className="w-4 h-4" />
          {t("Yangi kirim")}
        </Button>
      </div>

      <Table>
        <TableHead>
          <tr>
            <th>{t("Hujjat")}</th>
            <th>{t("Sana")}</th>
            <th>{t("Yetkazuvchi")}</th>
            <th>{t("Mahsulotlar")}</th>
            <th>{t("Jami (UZS)")}</th>
            <th>{t("Jami (USD)")}</th>
            <th></th>
          </tr>
        </TableHead>
        <TableBody>
          {purchasesQuery.isLoading ? (
            <TableLoading colSpan={7} />
          ) : purchases.length === 0 ? (
            <TableEmpty colSpan={7} message={t("Kirimlar topilmadi")} />
          ) : (
            purchases.map((p) => (
              <TableRow key={p.id}>
                <td className="font-mono text-xs">{p.documentNo}</td>
                <td className="text-sm">{new Date(p.createdAt).toLocaleDateString("uz")}</td>
                <td className="text-sm">{p.supplier?.name ?? "-"}</td>
                <td className="text-sm">{p.items.length} {t("ta")}</td>
                <td className="text-sm font-semibold text-red-600">{formatUzs(Number(p.totalUzs))}</td>
                <td className="text-sm font-semibold text-blue-600">${Number(p.totalUsd).toLocaleString()}</td>
                <td>
                  <button
                    className="text-gray-400 hover:text-brand-600 p-1"
                    onClick={() => { setDetailId(p.id); setMode("detail"); }}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ===== Transfer Tab =====
function TransferTab() {
  const queryClient = useQueryClient();
  const t = useT();
  const [form, setForm] = useState({ fromWarehouseId: "", toWarehouseId: "", productId: "", quantity: "", notes: "" });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
  });

  const stockQuery = useQuery({
    queryKey: ["warehouse", "stock"],
    queryFn: () => trpc.warehouse.getStock.query({}),
  });

  const mutation = useMutation({
    mutationFn: () =>
      trpc.warehouse.transfer.mutate({
        fromWarehouseId: Number(form.fromWarehouseId),
        toWarehouseId: Number(form.toWarehouseId),
        productId: Number(form.productId),
        quantity: Number(form.quantity),
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      setForm({ fromWarehouseId: "", toWarehouseId: "", productId: "", quantity: "", notes: "" });
      toast.success(getT()("Ko'chirish amalga oshirildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const warehouseOptions = (warehousesQuery.data ?? []).map((w) => ({ value: String(w.id), label: w.name }));
  const productOptions = (stockQuery.data ?? []).map((s) => ({
    value: String(s.product.id),
    label: `${s.product.name} (${Number(s.quantity)} ${s.product.unit})`,
  }));

  return (
    <div className="card card-body max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightLeft className="w-5 h-5 text-brand-600" />
        <h3 className="text-base font-semibold">{t("Omborlar arasi ko'chirish")}</h3>
      </div>
      <div className="space-y-4">
        <Select label={t("Qayerdan")} options={warehouseOptions} value={form.fromWarehouseId}
          onChange={(e) => setForm((f) => ({ ...f, fromWarehouseId: e.target.value }))} placeholder={t("Ombor tanlang")} />
        <Select label={t("Qayerga")} options={warehouseOptions} value={form.toWarehouseId}
          onChange={(e) => setForm((f) => ({ ...f, toWarehouseId: e.target.value }))} placeholder={t("Ombor tanlang")} />
        <Select label={t("Mahsulot")} options={productOptions} value={form.productId}
          onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} placeholder={t("Mahsulot tanlang")} />
        <Input label={t("Miqdor")} type="number" value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
        <Input label={t("Izoh")} value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        <Button loading={mutation.isPending} onClick={() => {
          if (!form.fromWarehouseId || !form.toWarehouseId || !form.productId || !form.quantity) {
            toast.error(getT()("Barcha maydonlarni to'ldiring")); return;
          }
          if (form.fromWarehouseId === form.toWarehouseId) {
            toast.error(getT()("Bir xil omborga ko'chirish mumkin emas")); return;
          }
          mutation.mutate();
        }}>
          <ArrowRightLeft className="w-4 h-4" />
          {t("Ko'chirish")}
        </Button>
      </div>
    </div>
  );
}

// ===== Write-Off Tab (Chiqim/Realizatsiya) =====
function WriteOffTab() {
  const queryClient = useQueryClient();
  const t = useT();
  const [form, setForm] = useState({ warehouseId: "", productId: "", quantity: "", reason: "" });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
  });

  const stockQuery = useQuery({
    queryKey: ["warehouse", "stock", form.warehouseId],
    queryFn: () => trpc.warehouse.getStock.query({
      warehouseId: form.warehouseId ? Number(form.warehouseId) : undefined,
    }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      trpc.warehouse.writeOff.mutate({
        warehouseId: Number(form.warehouseId),
        productId: Number(form.productId),
        quantity: Number(form.quantity),
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      setForm({ warehouseId: "", productId: "", quantity: "", reason: "" });
      toast.success(getT()("Chiqim amalga oshirildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const warehouseOptions = (warehousesQuery.data ?? []).map((w) => ({ value: String(w.id), label: w.name }));
  const productOptions = (stockQuery.data ?? [])
    .filter((s) => !form.warehouseId || s.warehouseId === Number(form.warehouseId))
    .map((s) => ({
      value: String(s.product.id),
      label: `${s.product.name} (${Number(s.quantity)} ${s.product.unit})`,
    }));

  return (
    <div className="card card-body max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <PackageMinus className="w-5 h-5 text-red-600" />
        <h3 className="text-base font-semibold">{t("Chiqim (Realizatsiya / Hisobdan chiqarish)")}</h3>
      </div>
      <div className="space-y-4">
        <Select label={t("Ombor")} options={warehouseOptions} value={form.warehouseId}
          onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value, productId: "" }))} placeholder={t("Ombor tanlang")} />
        <Select label={t("Mahsulot")} options={productOptions} value={form.productId}
          onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} placeholder={t("Mahsulot tanlang")} />
        <Input label={t("Miqdor")} type="number" value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
        <Input label={t("Sabab")} value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t("Chiqim sababi...")} />
        <Button variant="danger" loading={mutation.isPending} onClick={() => {
          if (!form.warehouseId || !form.productId || !form.quantity) {
            toast.error(getT()("Barcha maydonlarni to'ldiring")); return;
          }
          mutation.mutate();
        }}>
          <PackageMinus className="w-4 h-4" />
          {t("Chiqarish")}
        </Button>
      </div>
    </div>
  );
}

// ===== Return Tab (Qaytarish) =====
function ReturnTab() {
  const queryClient = useQueryClient();
  const t = useT();
  const [form, setForm] = useState({ warehouseId: "", productId: "", quantity: "", reason: "" });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
  });

  const productsQuery = useQuery({
    queryKey: ["product", "list-return"],
    queryFn: () => trpc.product.list.query({ limit: 1000 }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      trpc.warehouse.returnToStock.mutate({
        warehouseId: Number(form.warehouseId),
        productId: Number(form.productId),
        quantity: Number(form.quantity),
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      setForm({ warehouseId: "", productId: "", quantity: "", reason: "" });
      toast.success(getT()("Qaytarish amalga oshirildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const warehouseOptions = (warehousesQuery.data ?? []).map((w) => ({ value: String(w.id), label: w.name }));
  const productOptions = (productsQuery.data?.items ?? []).map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  return (
    <div className="card card-body max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <PackagePlus className="w-5 h-5 text-green-600" />
        <h3 className="text-base font-semibold">{t("Omborga qaytarish")}</h3>
      </div>
      <div className="space-y-4">
        <Select label={t("Ombor")} options={warehouseOptions} value={form.warehouseId}
          onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))} placeholder={t("Ombor tanlang")} />
        <Select label={t("Mahsulot")} options={productOptions} value={form.productId}
          onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} placeholder={t("Mahsulot tanlang")} />
        <Input label={t("Miqdor")} type="number" value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
        <Input label={t("Sabab")} value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t("Qaytarish sababi...")} />
        <Button variant="success" loading={mutation.isPending} onClick={() => {
          if (!form.warehouseId || !form.productId || !form.quantity) {
            toast.error(getT()("Barcha maydonlarni to'ldiring")); return;
          }
          mutation.mutate();
        }}>
          <PackagePlus className="w-4 h-4" />
          {t("Qaytarish")}
        </Button>
      </div>
    </div>
  );
}

// ===== Inventory Tab =====
function InventoryTab() {
  const queryClient = useQueryClient();
  const t = useT();
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState<Array<{ productId: number; productName: string; expected: number; actual: string; unit: string }>>([]);
  const [notes, setNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
  });

  const stockQuery = useQuery({
    queryKey: ["warehouse", "stock", warehouseId],
    queryFn: () => trpc.warehouse.getStock.query({ warehouseId: Number(warehouseId) }),
    enabled: !!warehouseId,
  });

  const historyQuery = useQuery({
    queryKey: ["warehouse", "inventoryChecks"],
    queryFn: () => trpc.warehouse.listInventoryChecks.query(),
    enabled: showHistory,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      trpc.warehouse.createInventoryCheck.mutate({
        warehouseId: Number(warehouseId),
        items: items.map((i) => ({ productId: i.productId, actualQty: Number(i.actual) || 0 })),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      setItems([]);
      setNotes("");
      toast.success(getT()("Inventarizatsiya yaratildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const applyMutation = useMutation({
    mutationFn: (id: number) => trpc.warehouse.applyInventoryCheck.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success(getT()("Inventarizatsiya qo'llanildi — qoldiqlar yangilandi"));
    },
    onError: (err) => toast.error(err.message),
  });

  // Load stock items into inventory form
  function loadStockForInventory() {
    const stocks = stockQuery.data ?? [];
    setItems(
      stocks.map((s) => ({
        productId: s.product.id,
        productName: s.product.name,
        expected: Number(s.quantity),
        actual: String(Number(s.quantity)),
        unit: s.product.unit,
      })),
    );
  }

  const warehouseOptions = (warehousesQuery.data ?? []).map((w) => ({ value: String(w.id), label: w.name }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-brand-600" />
          <h3 className="text-base font-semibold">{t("Inventarizatsiya")}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? t("Yangi yaratish") : t("Tarix")}
        </Button>
      </div>

      {showHistory ? (
        // History
        <Table>
          <TableHead>
            <tr>
              <th>{t("Hujjat")}</th>
              <th>{t("Sana")}</th>
              <th>{t("Holat")}</th>
              <th>{t("Mahsulotlar")}</th>
              <th>{t("Amallar")}</th>
            </tr>
          </TableHead>
          <TableBody>
            {(historyQuery.data ?? []).length === 0 ? (
              <TableEmpty colSpan={5} message={t("Inventarizatsiyalar topilmadi")} />
            ) : (
              (historyQuery.data ?? []).map((check) => (
                <TableRow key={check.id}>
                  <td className="font-mono text-xs">{check.documentNo}</td>
                  <td className="text-sm">{new Date(check.createdAt).toLocaleDateString("uz")}</td>
                  <td>
                    <Badge variant={check.status === "COMPLETED" ? "success" : check.status === "IN_PROGRESS" ? "warning" : "danger"}>
                      {check.status === "COMPLETED" ? t("Yakunlangan") : check.status === "IN_PROGRESS" ? t("Jarayonda") : t("Bekor qilingan")}
                    </Badge>
                  </td>
                  <td className="text-sm">{check.items.length} {t("ta")}</td>
                  <td>
                    {check.status === "IN_PROGRESS" && (
                      <Button size="sm" onClick={() => applyMutation.mutate(check.id)} loading={applyMutation.isPending}>
                        {t("Qo'llash")}
                      </Button>
                    )}
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      ) : (
        // Create new inventory check
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-48">
              <Select label={t("Ombor")} options={warehouseOptions} value={warehouseId}
                onChange={(e) => { setWarehouseId(e.target.value); setItems([]); }} placeholder={t("Ombor tanlang")} />
            </div>
            {warehouseId && (
              <Button variant="secondary" size="sm" onClick={loadStockForInventory} className="mt-6">
                {t("Mahsulotlarni yuklash")}
              </Button>
            )}
          </div>

          {items.length > 0 && (
            <>
              <Table>
                <TableHead>
                  <tr>
                    <th>{t("Mahsulot")}</th>
                    <th>{t("Kutilgan")}</th>
                    <th>{t("Haqiqiy")}</th>
                    <th>{t("Farq")}</th>
                  </tr>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => {
                    const diff = (Number(item.actual) || 0) - item.expected;
                    return (
                      <TableRow key={item.productId}>
                        <td className="font-medium">{item.productName}</td>
                        <td className="text-sm text-gray-500">{item.expected} {item.unit}</td>
                        <td>
                          <input
                            type="number"
                            className="input-field w-24 text-sm py-1"
                            value={item.actual}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[idx] = { ...item, actual: e.target.value };
                              setItems(newItems);
                            }}
                          />
                        </td>
                        <td>
                          <span className={`text-sm font-semibold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-400"}`}>
                            {diff > 0 ? "+" : ""}{diff} {item.unit}
                          </span>
                        </td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Input label={t("Izoh")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Inventarizatsiya izohi...")} />
              <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
                <ClipboardCheck className="w-4 h-4" />
                {t("Inventarizatsiya yaratish")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Revalue Tab =====
function RevalueTab() {
  const queryClient = useQueryClient();
  const t = useT();
  const [form, setForm] = useState({ productId: "", newPriceUzs: "", newPriceUsd: "", reason: "" });
  const [showHistory, setShowHistory] = useState(false);

  const productsQuery = useQuery({
    queryKey: ["product", "list-revalue"],
    queryFn: () => trpc.product.list.query({ limit: 1000 }),
  });

  const historyQuery = useQuery({
    queryKey: ["warehouse", "revaluations"],
    queryFn: () => trpc.warehouse.listRevaluations.query(),
    enabled: showHistory,
  });

  const mutation = useMutation({
    mutationFn: () =>
      trpc.warehouse.revalue.mutate({
        productId: Number(form.productId),
        newPriceUzs: Number(form.newPriceUzs),
        newPriceUsd: Number(form.newPriceUsd),
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      setForm({ productId: "", newPriceUzs: "", newPriceUsd: "", reason: "" });
      toast.success(getT()("Qayta baholash amalga oshirildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const productOptions = (productsQuery.data?.items ?? []).map((p) => ({
    value: String(p.id),
    label: `${p.name} (tannarx: ${formatUzs(Number(p.costPriceUzs))})`,
  }));

  // Fill current price when product selected
  const selectedProduct = (productsQuery.data?.items ?? []).find((p) => String(p.id) === form.productId);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-600" />
          <h3 className="text-base font-semibold">{t("Qayta baholash (tannarx o'zgartirish)")}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? t("Yangi yaratish") : t("Tarix")}
        </Button>
      </div>

      {showHistory ? (
        <Table>
          <TableHead>
            <tr>
              <th>{t("Hujjat")}</th>
              <th>{t("Sana")}</th>
              <th>{t("Eski narx")}</th>
              <th>{t("Yangi narx")}</th>
              <th>{t("Sabab")}</th>
            </tr>
          </TableHead>
          <TableBody>
            {(historyQuery.data ?? []).length === 0 ? (
              <TableEmpty colSpan={5} message={t("Qayta baholashlar topilmadi")} />
            ) : (
              (historyQuery.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <td className="font-mono text-xs">{r.documentNo}</td>
                  <td className="text-sm">{new Date(r.createdAt).toLocaleDateString("uz")}</td>
                  <td className="text-sm">{formatUzs(Number(r.oldPriceUzs))}</td>
                  <td className="text-sm font-semibold">{formatUzs(Number(r.newPriceUzs))}</td>
                  <td className="text-sm text-gray-500">{r.reason || "-"}</td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      ) : (
        <div className="card card-body max-w-xl">
          <div className="space-y-4">
            <Select label={t("Mahsulot")} options={productOptions} value={form.productId}
              onChange={(e) => {
                const p = (productsQuery.data?.items ?? []).find((pr) => String(pr.id) === e.target.value);
                setForm({
                  productId: e.target.value,
                  newPriceUzs: p ? String(Number(p.costPriceUzs)) : "",
                  newPriceUsd: p ? String(Number(p.costPriceUsd)) : "",
                  reason: "",
                });
              }}
              placeholder={t("Mahsulot tanlang")}
            />
            {selectedProduct && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p>{t("Joriy tannarx")}: <strong>{formatUzs(Number(selectedProduct.costPriceUzs))}</strong></p>
              </div>
            )}
            <Input label={t("Yangi tannarx (UZS)")} type="number" value={form.newPriceUzs}
              onChange={(e) => setForm((f) => ({ ...f, newPriceUzs: e.target.value }))} />
            <Input label={t("Yangi tannarx (USD)")} type="number" value={form.newPriceUsd}
              onChange={(e) => setForm((f) => ({ ...f, newPriceUsd: e.target.value }))} />
            <Input label={t("Sabab")} value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t("Qayta baholash sababi...")} />
            <Button loading={mutation.isPending} onClick={() => {
              if (!form.productId || !form.newPriceUzs) {
                toast.error(getT()("Mahsulot va narxni kiriting")); return;
              }
              mutation.mutate();
            }}>
              <RotateCcw className="w-4 h-4" />
              {t("Qayta baholash")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
