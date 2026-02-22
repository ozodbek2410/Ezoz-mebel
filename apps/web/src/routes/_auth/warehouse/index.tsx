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
} from "@/components/ui";
import { CurrencyDisplay } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { formatUzs } from "@ezoz/shared";
import toast from "react-hot-toast";

export function WarehousePage() {
  const { isBoss } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("stock");

  return (
    <>
      <PageHeader title="Ombor" />

      <div className="page-body">
        <Tabs
          tabs={[
            { id: "stock", label: "Qoldiqlar" },
            { id: "purchase", label: "Kirim" },
            { id: "transfer", label: "Ko'chirish" },
            ...(isBoss()
              ? [
                  { id: "writeoff", label: "Chiqim" },
                  { id: "return", label: "Qaytarish" },
                  { id: "inventory", label: "Inventarizatsiya" },
                  { id: "revalue", label: "Qayta baholash" },
                ]
              : []),
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
      <div className="flex items-center gap-4 mb-4">
        <div className="w-48">
          <Select
            options={[{ value: "", label: "Barcha omborlar" }, ...warehouseOptions]}
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <SearchInput
            placeholder="Mahsulot qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Faqat kam qoldiq
        </label>
        {lowStockCount > 0 && (
          <Badge variant="warning">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {lowStockCount} ta kam
          </Badge>
        )}
      </div>

      <Table>
        <TableHead>
          <tr>
            <th>Kod</th>
            <th>Mahsulot</th>
            <th>Guruh</th>
            <th>Ombor</th>
            <th>Qoldiq</th>
            <th>Min</th>
            <th>Narx</th>
          </tr>
        </TableHead>
        <TableBody>
          {stockQuery.isLoading ? (
            <TableLoading colSpan={7} />
          ) : filtered.length === 0 ? (
            <TableEmpty colSpan={7} message="Omborda mahsulot topilmadi" />
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
  const { isBoss } = useAuth();
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
    queryFn: () => trpc.product.list.query({}),
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
      toast.success("Kirim muvaffaqiyatli saqlandi");
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
      toast.success("Yetkazuvchi qo'shildi");
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
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function addItemRow() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItemRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const warehouseOptions = (warehousesQuery.data ?? []).map((w) => ({ value: String(w.id), label: w.name }));
  const productOptions = (productsQuery.data ?? []).map((p) => ({
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
            <h3 className="text-base font-semibold">Kirim #{p.documentNo}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setMode("list"); setDetailId(null); }}>
            Ortga
          </Button>
        </div>
        <div className="card card-body space-y-3 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Sana:</span>
              <p className="font-medium">{new Date(p.createdAt).toLocaleDateString("uz")}</p>
            </div>
            <div>
              <span className="text-gray-500">Yetkazuvchi:</span>
              <p className="font-medium">{p.supplier?.name ?? "Noma'lum"}</p>
            </div>
            <div>
              <span className="text-gray-500">Jami UZS:</span>
              <p className="font-medium text-red-600">{formatUzs(Number(p.totalUzs))}</p>
            </div>
            <div>
              <span className="text-gray-500">Jami USD:</span>
              <p className="font-medium text-blue-600">${Number(p.totalUsd).toLocaleString()}</p>
            </div>
          </div>
          {p.notes && <p className="text-sm text-gray-500">Izoh: {p.notes}</p>}
        </div>
        <Table>
          <TableHead>
            <tr>
              <th>Mahsulot</th>
              <th>Miqdor</th>
              <th>Narx (UZS)</th>
              <th>Narx (USD)</th>
              <th>Jami (UZS)</th>
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
            <h3 className="text-base font-semibold">Yangi kirim</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { resetForm(); setMode("list"); }}>
            Bekor qilish
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label="Yetkazuvchi"
                  options={supplierOptions}
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  placeholder="Tanlang (ixtiyoriy)"
                />
              </div>
              {isBoss() && (
                <Button variant="secondary" size="sm" className="mb-0.5" onClick={() => setShowSupplierModal(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Select
              label="Ombor"
              options={warehouseOptions}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              placeholder="Ombor tanlang"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mahsulotlar</label>
            <Table>
              <TableHead>
                <tr>
                  <th className="w-[35%]">Mahsulot</th>
                  <th className="w-[15%]">Miqdor</th>
                  <th className="w-[20%]">Narx (UZS)</th>
                  <th className="w-[20%]">Narx (USD)</th>
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
                        <option value="">Tanlang</option>
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
              Qator qo'shish
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Kassa"
              options={[
                { value: "SALES", label: "Savdo kassasi" },
                { value: "SERVICE", label: "Xizmat kassasi" },
              ]}
              value={cashRegister}
              onChange={(e) => setCashRegister(e.target.value as "SALES" | "SERVICE")}
            />
            <Select
              label="To'lov turi"
              options={[
                { value: "CASH_UZS", label: "Naqd (UZS)" },
                { value: "CASH_USD", label: "Naqd (USD)" },
                { value: "CARD", label: "Karta" },
                { value: "TRANSFER", label: "O'tkazma" },
              ]}
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as "CASH_UZS" | "CASH_USD" | "CARD" | "TRANSFER")}
            />
            <Input label="Izoh" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kirim izohi..." />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-gray-500">
              {validItems.length > 0 && (
                <span>
                  {validItems.length} ta mahsulot | Jami:{" "}
                  <span className="text-red-600 font-semibold">
                    {formatUzs(validItems.reduce((sum, i) => sum + (Number(i.priceUzs) || 0) * (Number(i.quantity) || 0), 0))}
                  </span>
                </span>
              )}
            </div>
            <Button
              loading={purchaseMutation.isPending}
              onClick={() => {
                if (!warehouseId) { toast.error("Ombor tanlang"); return; }
                if (validItems.length === 0) { toast.error("Kamida bitta mahsulot qo'shing"); return; }
                purchaseMutation.mutate();
              }}
            >
              <PackageCheck className="w-4 h-4" />
              Saqlash
            </Button>
          </div>
        </div>

        {/* Yangi yetkazuvchi modal */}
        <Modal open={showSupplierModal} onClose={() => setShowSupplierModal(false)} title="Yangi yetkazuvchi">
          <div className="space-y-4">
            <Input label="Ism / Kompaniya" value={newSupplier.name}
              onChange={(e) => setNewSupplier((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Telefon" value={newSupplier.phone}
              onChange={(e) => setNewSupplier((f) => ({ ...f, phone: e.target.value }))} />
            <Input label="Izoh" value={newSupplier.notes}
              onChange={(e) => setNewSupplier((f) => ({ ...f, notes: e.target.value }))} />
            <Button loading={createSupplierMutation.isPending} onClick={() => {
              if (!newSupplier.name.trim()) { toast.error("Ism kiriting"); return; }
              createSupplierMutation.mutate();
            }}>
              Saqlash
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
          <h3 className="text-base font-semibold">Kirimlar ro'yxati</h3>
        </div>
        <Button size="sm" onClick={() => setMode("create")}>
          <Plus className="w-4 h-4" />
          Yangi kirim
        </Button>
      </div>

      <Table>
        <TableHead>
          <tr>
            <th>Hujjat</th>
            <th>Sana</th>
            <th>Yetkazuvchi</th>
            <th>Mahsulotlar</th>
            <th>Jami (UZS)</th>
            <th>Jami (USD)</th>
            <th></th>
          </tr>
        </TableHead>
        <TableBody>
          {purchasesQuery.isLoading ? (
            <TableLoading colSpan={7} />
          ) : purchases.length === 0 ? (
            <TableEmpty colSpan={7} message="Kirimlar topilmadi" />
          ) : (
            purchases.map((p) => (
              <TableRow key={p.id}>
                <td className="font-mono text-xs">{p.documentNo}</td>
                <td className="text-sm">{new Date(p.createdAt).toLocaleDateString("uz")}</td>
                <td className="text-sm">{p.supplier?.name ?? "-"}</td>
                <td className="text-sm">{p.items.length} ta</td>
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
      toast.success("Ko'chirish amalga oshirildi");
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
        <h3 className="text-base font-semibold">Omborlar arasi ko'chirish</h3>
      </div>
      <div className="space-y-4">
        <Select label="Qayerdan" options={warehouseOptions} value={form.fromWarehouseId}
          onChange={(e) => setForm((f) => ({ ...f, fromWarehouseId: e.target.value }))} placeholder="Ombor tanlang" />
        <Select label="Qayerga" options={warehouseOptions} value={form.toWarehouseId}
          onChange={(e) => setForm((f) => ({ ...f, toWarehouseId: e.target.value }))} placeholder="Ombor tanlang" />
        <Select label="Mahsulot" options={productOptions} value={form.productId}
          onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} placeholder="Mahsulot tanlang" />
        <Input label="Miqdor" type="number" value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
        <Input label="Izoh" value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        <Button loading={mutation.isPending} onClick={() => {
          if (!form.fromWarehouseId || !form.toWarehouseId || !form.productId || !form.quantity) {
            toast.error("Barcha maydonlarni to'ldiring"); return;
          }
          if (form.fromWarehouseId === form.toWarehouseId) {
            toast.error("Bir xil omborga ko'chirish mumkin emas"); return;
          }
          mutation.mutate();
        }}>
          <ArrowRightLeft className="w-4 h-4" />
          Ko'chirish
        </Button>
      </div>
    </div>
  );
}

// ===== Write-Off Tab (Chiqim/Realizatsiya) =====
function WriteOffTab() {
  const queryClient = useQueryClient();
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
      toast.success("Chiqim amalga oshirildi");
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
        <h3 className="text-base font-semibold">Chiqim (Realizatsiya / Hisobdan chiqarish)</h3>
      </div>
      <div className="space-y-4">
        <Select label="Ombor" options={warehouseOptions} value={form.warehouseId}
          onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value, productId: "" }))} placeholder="Ombor tanlang" />
        <Select label="Mahsulot" options={productOptions} value={form.productId}
          onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} placeholder="Mahsulot tanlang" />
        <Input label="Miqdor" type="number" value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
        <Input label="Sabab" value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Chiqim sababi..." />
        <Button variant="danger" loading={mutation.isPending} onClick={() => {
          if (!form.warehouseId || !form.productId || !form.quantity) {
            toast.error("Barcha maydonlarni to'ldiring"); return;
          }
          mutation.mutate();
        }}>
          <PackageMinus className="w-4 h-4" />
          Chiqarish
        </Button>
      </div>
    </div>
  );
}

// ===== Return Tab (Qaytarish) =====
function ReturnTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ warehouseId: "", productId: "", quantity: "", reason: "" });

  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
  });

  const productsQuery = useQuery({
    queryKey: ["product", "list-return"],
    queryFn: () => trpc.product.list.query({}),
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
      toast.success("Qaytarish amalga oshirildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const warehouseOptions = (warehousesQuery.data ?? []).map((w) => ({ value: String(w.id), label: w.name }));
  const productOptions = (productsQuery.data ?? []).map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  return (
    <div className="card card-body max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <PackagePlus className="w-5 h-5 text-green-600" />
        <h3 className="text-base font-semibold">Omborga qaytarish</h3>
      </div>
      <div className="space-y-4">
        <Select label="Ombor" options={warehouseOptions} value={form.warehouseId}
          onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))} placeholder="Ombor tanlang" />
        <Select label="Mahsulot" options={productOptions} value={form.productId}
          onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} placeholder="Mahsulot tanlang" />
        <Input label="Miqdor" type="number" value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
        <Input label="Sabab" value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Qaytarish sababi..." />
        <Button variant="success" loading={mutation.isPending} onClick={() => {
          if (!form.warehouseId || !form.productId || !form.quantity) {
            toast.error("Barcha maydonlarni to'ldiring"); return;
          }
          mutation.mutate();
        }}>
          <PackagePlus className="w-4 h-4" />
          Qaytarish
        </Button>
      </div>
    </div>
  );
}

// ===== Inventory Tab =====
function InventoryTab() {
  const queryClient = useQueryClient();
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
      toast.success("Inventarizatsiya yaratildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const applyMutation = useMutation({
    mutationFn: (id: number) => trpc.warehouse.applyInventoryCheck.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success("Inventarizatsiya qo'llanildi — qoldiqlar yangilandi");
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
          <h3 className="text-base font-semibold">Inventarizatsiya</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "Yangi yaratish" : "Tarix"}
        </Button>
      </div>

      {showHistory ? (
        // History
        <Table>
          <TableHead>
            <tr>
              <th>Hujjat</th>
              <th>Sana</th>
              <th>Holat</th>
              <th>Mahsulotlar</th>
              <th>Amallar</th>
            </tr>
          </TableHead>
          <TableBody>
            {(historyQuery.data ?? []).length === 0 ? (
              <TableEmpty colSpan={5} message="Inventarizatsiyalar topilmadi" />
            ) : (
              (historyQuery.data ?? []).map((check) => (
                <TableRow key={check.id}>
                  <td className="font-mono text-xs">{check.documentNo}</td>
                  <td className="text-sm">{new Date(check.createdAt).toLocaleDateString("uz")}</td>
                  <td>
                    <Badge variant={check.status === "COMPLETED" ? "success" : check.status === "IN_PROGRESS" ? "warning" : "danger"}>
                      {check.status === "COMPLETED" ? "Yakunlangan" : check.status === "IN_PROGRESS" ? "Jarayonda" : "Bekor qilingan"}
                    </Badge>
                  </td>
                  <td className="text-sm">{check.items.length} ta</td>
                  <td>
                    {check.status === "IN_PROGRESS" && (
                      <Button size="sm" onClick={() => applyMutation.mutate(check.id)} loading={applyMutation.isPending}>
                        Qo'llash
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
              <Select label="Ombor" options={warehouseOptions} value={warehouseId}
                onChange={(e) => { setWarehouseId(e.target.value); setItems([]); }} placeholder="Ombor tanlang" />
            </div>
            {warehouseId && (
              <Button variant="secondary" size="sm" onClick={loadStockForInventory} className="mt-6">
                Mahsulotlarni yuklash
              </Button>
            )}
          </div>

          {items.length > 0 && (
            <>
              <Table>
                <TableHead>
                  <tr>
                    <th>Mahsulot</th>
                    <th>Kutilgan</th>
                    <th>Haqiqiy</th>
                    <th>Farq</th>
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
              <Input label="Izoh" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Inventarizatsiya izohi..." />
              <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
                <ClipboardCheck className="w-4 h-4" />
                Inventarizatsiya yaratish
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
  const [form, setForm] = useState({ productId: "", newPriceUzs: "", newPriceUsd: "", reason: "" });
  const [showHistory, setShowHistory] = useState(false);

  const productsQuery = useQuery({
    queryKey: ["product", "list-revalue"],
    queryFn: () => trpc.product.list.query({}),
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
      toast.success("Qayta baholash amalga oshirildi");
    },
    onError: (err) => toast.error(err.message),
  });

  const productOptions = (productsQuery.data ?? []).map((p) => ({
    value: String(p.id),
    label: `${p.name} (tannarx: ${formatUzs(Number(p.costPriceUzs))})`,
  }));

  // Fill current price when product selected
  const selectedProduct = (productsQuery.data ?? []).find((p) => String(p.id) === form.productId);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-600" />
          <h3 className="text-base font-semibold">Qayta baholash (tannarx o'zgartirish)</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "Yangi yaratish" : "Tarix"}
        </Button>
      </div>

      {showHistory ? (
        <Table>
          <TableHead>
            <tr>
              <th>Hujjat</th>
              <th>Sana</th>
              <th>Eski narx</th>
              <th>Yangi narx</th>
              <th>Sabab</th>
            </tr>
          </TableHead>
          <TableBody>
            {(historyQuery.data ?? []).length === 0 ? (
              <TableEmpty colSpan={5} message="Qayta baholashlar topilmadi" />
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
            <Select label="Mahsulot" options={productOptions} value={form.productId}
              onChange={(e) => {
                const p = (productsQuery.data ?? []).find((pr) => String(pr.id) === e.target.value);
                setForm({
                  productId: e.target.value,
                  newPriceUzs: p ? String(Number(p.costPriceUzs)) : "",
                  newPriceUsd: p ? String(Number(p.costPriceUsd)) : "",
                  reason: "",
                });
              }}
              placeholder="Mahsulot tanlang"
            />
            {selectedProduct && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p>Joriy tannarx: <strong>{formatUzs(Number(selectedProduct.costPriceUzs))}</strong></p>
              </div>
            )}
            <Input label="Yangi tannarx (UZS)" type="number" value={form.newPriceUzs}
              onChange={(e) => setForm((f) => ({ ...f, newPriceUzs: e.target.value }))} />
            <Input label="Yangi tannarx (USD)" type="number" value={form.newPriceUsd}
              onChange={(e) => setForm((f) => ({ ...f, newPriceUsd: e.target.value }))} />
            <Input label="Sabab" value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Qayta baholash sababi..." />
            <Button loading={mutation.isPending} onClick={() => {
              if (!form.productId || !form.newPriceUzs) {
                toast.error("Mahsulot va narxni kiriting"); return;
              }
              mutation.mutate();
            }}>
              <RotateCcw className="w-4 h-4" />
              Qayta baholash
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
