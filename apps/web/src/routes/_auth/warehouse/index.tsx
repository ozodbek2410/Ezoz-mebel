import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Warehouse,
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
  Search,
  X,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  CircleDollarSign,
  HandCoins,
  Wrench,
  User,
  CheckCircle,
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
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useAuth } from "@/hooks/useAuth";
import { useT, getT } from "@/hooks/useT";
import { formatUzs, convertToUzs, convertToUsd, formatNumber } from "@ezoz/shared";
import { useCurrencyStore } from "@/store/currency.store";
import toast from "react-hot-toast";

export function WarehousePage() {
  const { isBoss, can } = useAuth();
  const t = useT();
  const [activeTab, setActiveTab] = useState("stock");

  return (
    <div className="page-enter">
      <PageHeader title={t("Ombor")} />

      <div className="page-body">
        <Tabs
          tabs={[
            { id: "stock", label: t("Qoldiqlar") },
            { id: "purchase", label: t("Kirim") },
            { id: "tayyor", label: t("Tayyor (Ustaxona)") },
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
          {activeTab === "tayyor" && <TayyorTab />}
          {activeTab === "writeoff" && <WriteOffTab />}
          {activeTab === "return" && <ReturnTab />}
          {activeTab === "inventory" && <InventoryTab />}
          {activeTab === "revalue" && <RevalueTab />}
        </div>
      </div>
    </div>
  );
}

// ===== Stock Tab =====
function StockTab() {
  const t = useT();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState("");

  const stockQuery = useQuery({
    queryKey: ["warehouse", "stock", lowStockOnly],
    queryFn: () => trpc.warehouse.getStock.query({ lowStockOnly }),
  });

  const stocks = stockQuery.data ?? [];
  const filtered = search
    ? stocks.filter(
        (s) =>
          s.product.name.toLowerCase().includes(search.toLowerCase()) ||
          s.product.code.toLowerCase().includes(search.toLowerCase()),
      )
    : stocks;

  const lowStockCount = stocks.filter(
    (s) => Number(s.quantity) <= Number(s.product.minStockAlert) && Number(s.product.minStockAlert) > 0,
  ).length;

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
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
              className="rounded border-slate-300"
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
            <th>{t("Qoldiq")}</th>
            <th>{t("Min")}</th>
            <th>{t("Narx")}</th>
          </tr>
        </TableHead>
        <TableBody>
          {stockQuery.isLoading ? (
            <TableLoading colSpan={6} />
          ) : filtered.length === 0 ? (
            <TableEmpty colSpan={6} message={t("Omborda mahsulot topilmadi")} />
          ) : (
            filtered.map((s) => {
              const qty = Number(s.quantity);
              const minAlert = Number(s.product.minStockAlert);
              const stockClass = qty <= 0 ? "stock-empty" : qty <= minAlert && minAlert > 0 ? "stock-low" : "stock-ok";

              return (
                <TableRow key={s.id}>
                  <td className="font-mono text-xs text-slate-500">{s.product.code}</td>
                  <td className="font-medium text-slate-900">{s.product.name}</td>
                  <td><Badge variant="neutral">{s.product.category.name}</Badge></td>
                  <td><span className={stockClass}>{qty} {s.product.unit}</span></td>
                  <td className="text-sm text-slate-500">{minAlert > 0 ? minAlert : "-"}</td>
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
  id: number;
  productId: string;
  productSearch: string;
  dropdownOpen: boolean;
  quantity: string;
  priceUzs: string;
  priceUsd: string;
}

let purchaseItemId = 0;
function createEmptyItem(): PurchaseItemRow {
  return { id: ++purchaseItemId, productId: "", productSearch: "", dropdownOpen: false, quantity: "", priceUzs: "", priceUsd: "" };
}

function PurchaseTab() {
  const queryClient = useQueryClient();
  const { isBoss, can } = useAuth();
  const t = useT();
  const rate = useCurrencyStore((s) => s.rate);
  const [mode, setMode] = useState<"list" | "create" | "detail">("list");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<PurchaseItemRow[]>([createEmptyItem()]);
  const [notes, setNotes] = useState("");
  const [cashRegister, setCashRegister] = useState<"SALES" | "SERVICE">("SALES");
  const [paymentType, setPaymentType] = useState<"CASH_UZS" | "CASH_USD" | "CARD" | "TRANSFER" | "DEBT">("CASH_UZS");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "", notes: "" });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);

  const purchasesQuery = useQuery({
    queryKey: ["warehouse", "purchases"],
    queryFn: () => trpc.warehouse.listPurchases.query(),
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
    setSupplierSearch("");
    setItems([createEmptyItem()]);
    setNotes("");
    setCashRegister("SALES");
    setPaymentType("CASH_UZS");
    setPaymentModalOpen(false);
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
    setItems((prev) => [...prev, createEmptyItem()]);
  }

  function removeItemRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const allProducts = productsQuery.data?.items ?? [];
  const allSuppliers = suppliersQuery.data?.suppliers ?? [];

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return allSuppliers;
    const q = supplierSearch.toLowerCase();
    return allSuppliers.filter((s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)));
  }, [allSuppliers, supplierSearch]);

  const selectedSupplierName = allSuppliers.find((s) => String(s.id) === supplierId)?.name ?? "";

  const validItems = items.filter((i) => i.productId && Number(i.quantity) > 0);
  const totalUzs = validItems.reduce((sum, i) => sum + (Number(i.priceUzs) || 0) * (Number(i.quantity) || 0), 0);
  const totalUsd = validItems.reduce((sum, i) => sum + (Number(i.priceUsd) || 0) * (Number(i.quantity) || 0), 0);

  function getFilteredProducts(search: string) {
    if (!search) return allProducts.slice(0, 50);
    const q = search.toLowerCase();
    return allProducts.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }

  function getProductName(productId: string) {
    const p = allProducts.find((pr) => String(pr.id) === productId);
    return p ? `${p.code} — ${p.name}` : "";
  }

  function selectProduct(idx: number, productId: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, productId, productSearch: "", dropdownOpen: false } : item));
  }

  function clearProduct(idx: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, productId: "", productSearch: "", dropdownOpen: false } : item));
  }

  function setItemDropdown(idx: number, open: boolean) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, dropdownOpen: open } : item));
  }

  function setItemSearch(idx: number, search: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, productSearch: search } : item));
  }

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
              <span className="text-slate-500">{t("Sana")}:</span>
              <p className="font-medium">{new Date(p.createdAt).toLocaleDateString("uz")}</p>
            </div>
            <div>
              <span className="text-slate-500">{t("Yetkazuvchi")}:</span>
              <p className="font-medium">{p.supplier?.name ?? t("Noma'lum")}</p>
            </div>
            <div>
              <span className="text-slate-500">{t("Jami UZS")}:</span>
              <p className="font-medium text-red-600">{formatUzs(Number(p.totalUzs))}</p>
            </div>
            <div>
              <span className="text-slate-500">{t("Jami USD")}:</span>
              <p className="font-medium text-blue-600">${Number(p.totalUsd).toLocaleString()}</p>
            </div>
          </div>
          {p.notes && <p className="text-sm text-slate-500">{t("Izoh")}: {p.notes}</p>}
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
          {/* Supplier combobox */}
          <div className="flex items-end gap-2 max-w-md">
            <div className="flex-1 relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("Yetkazuvchi")}</label>
              {supplierId ? (
                <div className="input-field text-sm py-1.5 flex items-center justify-between">
                  <span className="font-medium">{selectedSupplierName}</span>
                  <button type="button" onClick={() => { setSupplierId(""); setSupplierSearch(""); }} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    className="input-field text-sm py-1.5 pl-8 w-full"
                    placeholder={t("Qidirish (ixtiyoriy)...")}
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    onFocus={() => setSupplierDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setSupplierDropdownOpen(false), 150)}
                  />
                  {supplierDropdownOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-48 overflow-y-auto">
                      {filteredSuppliers.length === 0 ? (
                        <div className="px-3 py-2.5 text-sm text-slate-400">{t("Topilmadi")}</div>
                      ) : (
                        filteredSuppliers.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm border-b border-slate-50 last:border-0 transition-colors"
                            onMouseDown={() => { setSupplierId(String(s.id)); setSupplierSearch(""); setSupplierDropdownOpen(false); }}
                          >
                            <span className="font-medium text-slate-700">{s.name}</span>
                            {s.phone && <span className="text-xs text-slate-400 ml-2">{s.phone}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            {(isBoss() || can("warehouse:purchase")) && (
              <Button variant="secondary" size="sm" className="mb-0.5" onClick={() => setShowSupplierModal(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Products table with inline combobox */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("Mahsulotlar")}</label>
            <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-[35%]">{t("Mahsulot")}</th>
                  <th className="w-[15%]">{t("Miqdor")}</th>
                  <th className="w-[20%]">{t("Narx (UZS)")}</th>
                  <th className="w-[20%]">{t("Narx (USD)")}</th>
                  <th className="w-[10%]"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-1.5 px-2">
                      <div className="relative">
                        {item.productId ? (
                          <div className="input-field text-sm py-1.5 flex items-center justify-between gap-1">
                            <span className="truncate text-slate-800">{getProductName(item.productId)}</span>
                            <button type="button" onClick={() => clearProduct(idx)} className="text-slate-400 hover:text-slate-600 shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <input
                              className="input-field text-sm py-1.5 pl-7 w-full"
                              placeholder={t("Qidirish...")}
                              value={item.productSearch}
                              onChange={(e) => setItemSearch(idx, e.target.value)}
                              onFocus={() => setItemDropdown(idx, true)}
                              onBlur={() => setTimeout(() => setItemDropdown(idx, false), 150)}
                            />
                            {item.dropdownOpen && (
                              <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-48 overflow-y-auto min-w-[280px]">
                                {getFilteredProducts(item.productSearch).length === 0 ? (
                                  <div className="px-3 py-2.5 text-sm text-slate-400">{t("Topilmadi")}</div>
                                ) : (
                                  getFilteredProducts(item.productSearch).map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm border-b border-slate-50 last:border-0 transition-colors"
                                      onMouseDown={() => selectProduct(idx, String(p.id))}
                                    >
                                      <span className="text-slate-400 text-xs mr-1.5">{p.code}</span>
                                      <span className="font-medium text-slate-700">{p.name}</span>
                                      <span className="text-xs text-slate-400 ml-1.5">({p.unit})</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" className="input-field text-sm py-1.5 w-full" value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)} placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" inputMode="decimal" className="input-field text-sm py-1.5 w-full" value={formatNumber(item.priceUzs)}
                        onChange={(e) => updateItem(idx, "priceUzs", e.target.value.replace(/\s/g, ""))} placeholder="0" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" inputMode="decimal" className="input-field text-sm py-1.5 w-full" value={formatNumber(item.priceUsd)}
                        onChange={(e) => updateItem(idx, "priceUsd", e.target.value.replace(/\s/g, ""))} placeholder="0" />
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
              </tbody>
            </table>
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={addItemRow}>
              <Plus className="w-4 h-4" />
              {t("Qator qo'shish")}
            </Button>
          </div>

          {/* Notes */}
          <Input label={t("Izoh")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Kirim izohi...")} />

          {/* Bottom: total + save */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-slate-500">
              {validItems.length > 0 && (
                <span>
                  {validItems.length} {t("ta mahsulot")} | {t("Jami")}:{" "}
                  <span className="text-red-600 font-semibold">{formatUzs(totalUzs)}</span>
                  {totalUsd > 0 && <span className="text-blue-600 ml-2">${totalUsd.toLocaleString()}</span>}
                </span>
              )}
            </div>
            <Button
              onClick={() => {
                if (validItems.length === 0) { toast.error(getT()("Kamida bitta mahsulot qo'shing")); return; }
                setPaymentModalOpen(true);
              }}
            >
              <PackageCheck className="w-4 h-4" />
              {t("Saqlash")}
            </Button>
          </div>
        </div>

        {/* Payment modal */}
        <Modal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title={t("Kirim tasdiqlash")}
          size="lg"
        >
          <div className="space-y-5">
            {/* Total */}
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-500 mb-1">{t("Jami summa")}</p>
              <p className="text-2xl font-bold text-red-600">{formatUzs(totalUzs)}</p>
              {totalUsd > 0 && <p className="text-sm text-blue-600 mt-0.5">${totalUsd.toLocaleString()}</p>}
              <p className="text-xs text-slate-400 mt-1">{validItems.length} {t("ta mahsulot")}{selectedSupplierName ? ` | ${selectedSupplierName}` : ""}</p>
            </div>

            {/* Cash register */}
            <Select
              label={t("Kassa")}
              options={[
                { value: "SALES", label: t("Savdo kassasi") },
                { value: "SERVICE", label: t("Xizmat kassasi") },
              ]}
              value={cashRegister}
              onChange={(e) => setCashRegister(e.target.value as "SALES" | "SERVICE")}
            />

            {/* Payment type buttons */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("To'lov turi")}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {([
                  { value: "CASH_UZS", label: t("Naqd (UZS)"), icon: Banknote, color: "emerald" },
                  { value: "CASH_USD", label: t("Naqd ($)"), icon: CircleDollarSign, color: "blue" },
                  { value: "CARD", label: t("Karta"), icon: CreditCard, color: "violet" },
                  { value: "TRANSFER", label: t("O'tkazma"), icon: ArrowRightLeft, color: "sky" },
                  { value: "DEBT", label: t("Qarzga"), icon: HandCoins, color: "red" },
                ] as const).map((opt) => {
                  const Icon = opt.icon;
                  const isActive = paymentType === opt.value;
                  const colorMap: Record<string, string> = {
                    emerald: isActive ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "border-slate-200 hover:border-emerald-300 text-slate-600",
                    blue: isActive ? "bg-blue-50 border-blue-500 text-blue-700" : "border-slate-200 hover:border-blue-300 text-slate-600",
                    violet: isActive ? "bg-violet-50 border-violet-500 text-violet-700" : "border-slate-200 hover:border-violet-300 text-slate-600",
                    sky: isActive ? "bg-sky-50 border-sky-500 text-sky-700" : "border-slate-200 hover:border-sky-300 text-slate-600",
                    red: isActive ? "bg-red-50 border-red-500 text-red-700" : "border-slate-200 hover:border-red-300 text-slate-600",
                  };
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${colorMap[opt.color]}`}
                      onClick={() => setPaymentType(opt.value)}
                    >
                      <Icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {paymentType === "DEBT" && !supplierId && (
                <p className="text-xs text-red-500 mt-2">{t("Qarzga kirim uchun ta'minotchini tanlang")}</p>
              )}
            </div>

            {/* Confirm */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPaymentModalOpen(false)}>{t("Bekor")}</Button>
              <Button
                loading={purchaseMutation.isPending}
                onClick={() => {
                  if (paymentType === "DEBT" && !supplierId) {
                    toast.error(getT()("Qarzga kirim uchun ta'minotchini tanlang"));
                    return;
                  }
                  purchaseMutation.mutate();
                }}
              >
                {t("Tasdiqlash")}
              </Button>
            </div>
          </div>
        </Modal>

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
                    className="text-slate-400 hover:text-brand-600 p-1"
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

// ===== Write-Off Tab (Chiqim/Realizatsiya) =====
function WriteOffTab() {
  const queryClient = useQueryClient();
  const t = useT();
  const [form, setForm] = useState({ productId: "", quantity: "", reason: "" });

  const stockQuery = useQuery({
    queryKey: ["warehouse", "stock"],
    queryFn: () => trpc.warehouse.getStock.query({}),
  });

  const mutation = useMutation({
    mutationFn: () =>
      trpc.warehouse.writeOff.mutate({
        productId: Number(form.productId),
        quantity: Number(form.quantity),
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      setForm({ productId: "", quantity: "", reason: "" });
      toast.success(getT()("Chiqim amalga oshirildi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const productOptions = (stockQuery.data ?? [])
    .filter((s) => Number(s.quantity) > 0)
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
        <Select label={t("Mahsulot")} options={productOptions} value={form.productId}
          onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} placeholder={t("Mahsulot tanlang")} />
        <Input label={t("Miqdor")} type="number" value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
        <Input label={t("Sabab")} value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t("Chiqim sababi...")} />
        <Button variant="danger" loading={mutation.isPending} onClick={() => {
          if (!form.productId || !form.quantity) {
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
  const [form, setForm] = useState({ productId: "", quantity: "", reason: "" });

  const productsQuery = useQuery({
    queryKey: ["product", "list-return"],
    queryFn: () => trpc.product.list.query({ limit: 1000 }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      trpc.warehouse.returnToStock.mutate({
        productId: Number(form.productId),
        quantity: Number(form.quantity),
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      setForm({ productId: "", quantity: "", reason: "" });
      toast.success(getT()("Qaytarish amalga oshirildi"));
    },
    onError: (err) => toast.error(err.message),
  });

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
        <Select label={t("Mahsulot")} options={productOptions} value={form.productId}
          onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} placeholder={t("Mahsulot tanlang")} />
        <Input label={t("Miqdor")} type="number" value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
        <Input label={t("Sabab")} value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t("Qaytarish sababi...")} />
        <Button variant="success" loading={mutation.isPending} onClick={() => {
          if (!form.productId || !form.quantity) {
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
  const [items, setItems] = useState<Array<{ productId: number; productName: string; expected: number; actual: string; unit: string }>>([]);
  const [notes, setNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const stockQuery = useQuery({
    queryKey: ["warehouse", "stock"],
    queryFn: () => trpc.warehouse.getStock.query({}),
  });

  const historyQuery = useQuery({
    queryKey: ["warehouse", "inventoryChecks"],
    queryFn: () => trpc.warehouse.listInventoryChecks.query(),
    enabled: showHistory,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      trpc.warehouse.createInventoryCheck.mutate({
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
        <div className="space-y-4">
          <Button variant="secondary" size="sm" onClick={loadStockForInventory}>
            {t("Mahsulotlarni yuklash")}
          </Button>

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
                        <td className="text-sm text-slate-500">{item.expected} {item.unit}</td>
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
                          <span className={`text-sm font-semibold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-slate-400"}`}>
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
                  <td className="text-sm text-slate-500">{r.reason || "-"}</td>
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
              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                <p>{t("Joriy tannarx")}: <strong>{formatUzs(Number(selectedProduct.costPriceUzs))}</strong></p>
              </div>
            )}
            <CurrencyInput label={t("Yangi tannarx (UZS)")} currency="UZS" value={form.newPriceUzs}
              onValueChange={(v) => setForm((f) => ({ ...f, newPriceUzs: v }))} />
            <CurrencyInput label={t("Yangi tannarx (USD)")} currency="USD" value={form.newPriceUsd}
              onValueChange={(v) => setForm((f) => ({ ...f, newPriceUsd: v }))} />
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

// ===== Tayyor Tab (Completed Workshop Orders) =====
function TayyorTab() {
  const t = useT();
  const [detailSaleId, setDetailSaleId] = useState<number | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["sale", "list", "workshop-completed"],
    queryFn: () => trpc.sale.list.query({
      saleType: "SERVICE",
      workshopStatus: "COMPLETED",
    }),
  });

  const detailQuery = useQuery({
    queryKey: ["sale", "getById", detailSaleId],
    queryFn: () => trpc.sale.getById.query({ id: detailSaleId! }),
    enabled: detailSaleId !== null,
  });

  const sales = ordersQuery.data?.sales ?? [];

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString("uz", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const detail = detailQuery.data;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table variant="report">
          <TableHead>
            <tr>
              <th className="w-10 text-center">#</th>
              <th>{t("Hujjat")}</th>
              <th>{t("Sana")}</th>
              <th>{t("Mijoz")}</th>
              <th className="text-center">{t("Bosqichlar")}</th>
              <th className="text-right">{t("Summa")}</th>
              <th className="w-20 text-center">{t("Amallar")}</th>
            </tr>
          </TableHead>
          <TableBody>
            {ordersQuery.isLoading ? (
              <TableLoading colSpan={7} />
            ) : sales.length === 0 ? (
              <TableEmpty colSpan={7} message={t("Tayyor buyurtmalar yo'q")} icon={<CheckCircle className="w-8 h-8" />} />
            ) : (
              sales.map((sale, idx) => (
                <TableRow key={sale.id}>
                  <td className="text-center text-slate-400">{idx + 1}</td>
                  <td className="font-mono text-xs text-slate-500">{sale.documentNo}</td>
                  <td className="text-slate-600 text-sm">{formatDate(sale.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-slate-300 shrink-0" />
                      <span className="font-medium">{sale.customer?.fullName ?? t("Oddiy mijoz")}</span>
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-sm font-medium text-amber-700">{sale._count.payments}</span>
                    </div>
                  </td>
                  <td className="text-right">
                    <CurrencyDisplay amountUzs={sale.totalUzs} amountUsd={sale.totalUsd} size="sm" />
                  </td>
                  <td className="text-center">
                    <button
                      className="p-1.5 hover:bg-indigo-50 rounded-md transition-colors"
                      title={t("Ko'rish")}
                      onClick={() => setDetailSaleId(sale.id)}
                    >
                      <Eye className="w-4 h-4 text-indigo-500" />
                    </button>
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail modal */}
      <Modal
        open={detailSaleId !== null}
        onClose={() => setDetailSaleId(null)}
        title={t("Buyurtma tafsiloti")}
        size="lg"
      >
        {detailQuery.isLoading ? (
          <div className="text-center py-8 text-slate-400">{t("Yuklanmoqda...")}</div>
        ) : detail ? (
          <div className="space-y-4">
            {/* Customer + sale info */}
            <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("Mijoz")}:</span>
                <span className="font-medium">{detail.customer?.fullName ?? t("Oddiy mijoz")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("Sana")}:</span>
                <span>{formatDate(detail.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("Jami")}:</span>
                <CurrencyDisplay amountUzs={detail.totalUzs} amountUsd={detail.totalUsd} size="sm" />
              </div>
            </div>

            {/* Sale items */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{t("Mahsulot/xizmatlar")}</p>
              <div className="space-y-1">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm py-1 px-2 bg-white border border-slate-100 rounded">
                    <span className="flex items-center gap-1.5">
                      {item.serviceName ? (
                        <Wrench className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Package className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                      {item.product?.name ?? item.serviceName ?? "—"}
                    </span>
                    <span className="text-slate-400">×{Number(item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Workshop task chain */}
            {"workshopTasks" in detail && Array.isArray(detail.workshopTasks) && detail.workshopTasks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{t("Ustaxona bosqichlari")}</p>
                <div className="space-y-2">
                  {(detail.workshopTasks as Array<{
                    id: number; stepOrder: number; description: string;
                    status: string; assignedTo: { fullName: string } | null;
                    startedAt: string | null; completedAt: string | null; notes: string | null;
                  }>).map((task) => (
                    <div key={task.id} className={`flex items-start gap-3 p-2.5 rounded-lg border ${task.status === "COMPLETED" ? "bg-green-50 border-green-200" : task.status === "IN_PROGRESS" ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                      <span className="text-xs font-bold text-slate-400 mt-0.5 w-5 shrink-0">#{task.stepOrder}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-800">{task.description}</span>
                          {task.assignedTo && (
                            <span className="text-xs text-indigo-600 font-medium">{task.assignedTo.fullName}</span>
                          )}
                        </div>
                        {task.completedAt && (
                          <span className="text-xs text-green-600 mt-0.5 block">
                            <CheckCircle className="w-3 h-3 inline mr-1" />
                            {formatDate(task.completedAt)}
                          </span>
                        )}
                        {task.notes && <p className="text-xs text-amber-700 mt-0.5">{task.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
