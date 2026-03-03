import { useState, useCallback, useMemo, useRef, useEffect, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Plus, ShoppingCart, Trash2, Check, X,
  User, Package, Banknote, Wrench, UserCheck,
} from "lucide-react";
import { useCartStore } from "@/store/cart.store";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Modal, Input, Select, SearchInput,
  Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading,
  Badge, Tabs,
} from "@/components/ui";
import { CurrencyDisplay, StatusBadge } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { useSocket, useSocketEvent } from "@/hooks/useSocket";
import { useT, getT } from "@/hooks/useT";
import { formatUzs, formatUsd, formatNumber, parseFormattedNumber } from "@ezoz/shared";
import toast from "react-hot-toast";
import { fetchAndPrintReceipt } from "@/lib/printReceipt";

export function SalesPage() {
  const location = useLocation();
  return <SalesPageInner key={location.pathname} />;
}

function SalesPageInner() {
  const { user, isBoss } = useAuth();
  const t = useT();
  const queryClient = useQueryClient();
  const location = useLocation();

  const isServiceMode = location.pathname.startsWith("/sales/service");
  const saleType = isServiceMode ? "SERVICE" : "PRODUCT";

  useSocket(useMemo(() => ["room:stock", "room:sales"], []));
  useSocketEvent("stock:updated", useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["product"] });
  }, [queryClient]));

  const navigate = useNavigate();
  const cartStore = useCartStore();
  const cart = cartStore.items;

  const [activeTab, setActiveTab] = useState("pos");
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; fullName: string } | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  // Service mode
  const [servicePanel, setServicePanel] = useState<"services" | "products">("services");

  // Payment
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSaleId, setPaymentSaleId] = useState<number | null>(null);
  const [paymentSaleTotal, setPaymentSaleTotal] = useState(0);
  const [paymentCustomerId, setPaymentCustomerId] = useState<number | undefined>(undefined);
  const [paymentForm, setPaymentForm] = useState({
    cashUzs: "0",
    cardUzs: "0",
  });

  // Warehouse auto-detect (cached — rarely changes)
  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const warehouses = warehousesQuery.data ?? [];
  const targetWarehouse = warehouses.find((w) =>
    isServiceMode ? w.name === "Sex" : w.name === "Asosiy ombor",
  );

  // Service types (cached — rarely changes)
  const serviceTypesQuery = useQuery({
    queryKey: ["serviceType", "list"],
    queryFn: () => trpc.serviceType.list.query(),
    enabled: isServiceMode,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const serviceTypes = serviceTypesQuery.data ?? [];

  // Masters (cached)
  const usersQuery = useQuery({
    queryKey: ["auth", "getUsers"],
    queryFn: () => trpc.auth.getUsers.query(),
    enabled: isServiceMode,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const masters = useMemo(
    () => (usersQuery.data ?? []).filter((u) => u.role === "MASTER"),
    [usersQuery.data],
  );

  // Products — load ALL once, filter client-side
  const productsQuery = useQuery({
    queryKey: ["product", "list", targetWarehouse?.id],
    queryFn: () =>
      trpc.product.list.query({
        warehouseId: targetWarehouse?.id,
        limit: 1000,
      }),
    enabled: !!targetWarehouse,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Debounced customer search
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    customerDebounceRef.current = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 300);
    return () => clearTimeout(customerDebounceRef.current);
  }, [customerSearch]);

  const customerSearchQuery = useQuery({
    queryKey: ["customer", "search", debouncedCustomerSearch],
    queryFn: () => trpc.customer.search.query({ query: debouncedCustomerSearch }),
    enabled: customerDropdownOpen && !selectedCustomer,
    staleTime: 30 * 1000,
  });

  const salesQuery = useQuery({
    queryKey: ["sale", "list", saleType],
    queryFn: () => trpc.sale.list.query({ saleType }),
    enabled: activeTab === "history",
    staleTime: 30 * 1000,
  });

  const hasWorkshopItems = cart.some((item) => item.serviceName && item.masterId);
  const hasUnassignedService = cart.some((item) => item.serviceName && !item.masterId);

  // Open payment modal (no sale created yet)
  function openPaymentModal() {
    setPaymentSaleId(null);
    setPaymentSaleTotal(cartTotal.uzs);
    setPaymentCustomerId(selectedCustomer?.id);
    setPaymentForm({ cashUzs: String(cartTotal.uzs), cardUzs: "0" });
    setPaymentOpen(true);
  }


  // Service mode: create sale immediately (no payment modal)
  const createServiceSale = useMutation({
    mutationFn: async () => {
      const sale = await trpc.sale.create.mutate({
        customerId: selectedCustomer?.id,
        warehouseId: targetWarehouse?.id,
        saleType: "SERVICE",
        items: cart.map((item) => ({
          productId: item.productId ?? undefined,
          serviceName: item.serviceName ?? undefined,
          quantity: item.quantity,
          priceUzs: item.priceUzs,
          priceUsd: item.priceUsd,
          masterId: item.masterId ?? undefined,
        })),
        goesToWorkshop: hasWorkshopItems,
        notes: saleNotes || undefined,
      });
      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      cartStore.clear();
      setSelectedCustomer(null);
      setSaleNotes("");
      toast.success(getT()("Sotuv yaratildi"));
      void fetchAndPrintReceipt(sale.id);
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelSale = useMutation({
    mutationFn: (id: number) => trpc.sale.cancel.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      toast.success(getT()("Sotuv bekor qilindi"));
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmSale = useMutation({
    mutationFn: async () => {
      let saleId: number;
      // New sale from POS
      if (!paymentSaleId) {
        const sale = await trpc.sale.create.mutate({
          customerId: selectedCustomer?.id,
          warehouseId: targetWarehouse?.id,
          saleType,
          items: cart.map((item) => ({
            productId: item.productId ?? undefined,
            serviceName: item.serviceName ?? undefined,
            quantity: item.quantity,
            priceUzs: item.priceUzs,
            priceUsd: item.priceUsd,
            masterId: item.masterId ?? undefined,
          })),
          goesToWorkshop: hasWorkshopItems,
          notes: saleNotes || undefined,
        });
        saleId = sale.id;
      } else {
        saleId = paymentSaleId;
      }
      // Create payments
      const customerId = paymentCustomerId;
      const cash = Number(paymentForm.cashUzs);
      const card = Number(paymentForm.cardUzs);
      if (cash > 0) {
        await trpc.payment.create.mutate({ saleId, customerId, amountUzs: cash, amountUsd: 0, paymentType: "CASH_UZS", source: "NEW_SALE" });
      }
      if (card > 0) {
        await trpc.payment.create.mutate({ saleId, customerId, amountUzs: card, amountUsd: 0, paymentType: "CARD", source: "NEW_SALE" });
      }
      // Complete sale
      await trpc.sale.complete.mutate({ id: saleId });
      return saleId;
    },
    onSuccess: (completedSaleId) => {
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      setPaymentOpen(false);
      setPaymentSaleId(null);
      if (!paymentSaleId) {
        cartStore.clear();
        setSelectedCustomer(null);
        setSaleNotes("");
      }
      toast.success(getT()("Sotuv yakunlandi"));
      void fetchAndPrintReceipt(completedSaleId);
    },
    onError: (err) => toast.error(err.message),
  });

  // Cart helpers (delegate to store)
  function addServiceToCart(name: string, uzs: number, usd: number) {
    cartStore.addService(name, uzs, usd);
  }

  // Custom service modal
  const [customServiceOpen, setCustomServiceOpen] = useState(false);
  const [customServiceForm, setCustomServiceForm] = useState({ name: "", price: "" });

  const cartTotal = useMemo(
    () => cart.reduce(
      (acc, item) => ({ uzs: acc.uzs + item.priceUzs * item.quantity, usd: acc.usd + item.priceUsd * item.quantity }),
      { uzs: 0, usd: 0 },
    ),
    [cart],
  );

  const allProducts = productsQuery.data?.items ?? [];

  // Client-side search + stock filter (for service mode products panel)
  const products = useMemo(() => {
    if (!productSearch) return allProducts;
    const q = productSearch.toLowerCase();
    return allProducts.filter((p) =>
      p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
  }, [allProducts, productSearch]);

  const availableProducts = useMemo(
    () => products.filter((p) => {
      const stock = p.stockItems[0] ? Number(p.stockItems[0].quantity) : 0;
      return stock > 0;
    }),
    [products],
  );
  const sales = salesQuery.data?.sales ?? [];

  // Map for O(1) cart lookup in service mode product cards
  const cartMap = useMemo(
    () => new Map(cart.filter((i) => i.productId).map((i) => [i.productId, i.quantity])),
    [cart],
  );

  function getMasterName(id: number | null) {
    if (!id) return null;
    return masters.find((m) => m.id === id)?.fullName ?? null;
  }

  // ===================== RENDER =====================
  return (
    <div className="page-enter">
      <PageHeader
        title={isServiceMode ? t("Xizmat kassasi") : t("Savdo kassasi")}
        actions={
          <Tabs
            tabs={[{ id: "pos", label: t("Kassa") }, { id: "history", label: t("Tarix") }]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        }
      />

      <div className="page-body">
        {activeTab === "pos" ? (
          isServiceMode ? (
            /* =============================================
               SERVICE MODE — horizontal layout (like product mode)
               LEFT: Services / Products
               RIGHT: Cart with master selection per item
            ============================================= */
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
              {/* ===== LEFT: Services / Products ===== */}
              <div className="flex-1 min-w-0">
                <div className="toggle-group mb-4">
                  <button
                    onClick={() => setServicePanel("services")}
                    className={servicePanel === "services" ? "toggle-group-btn toggle-group-btn-active" : "toggle-group-btn toggle-group-btn-inactive"}
                  >
                    <Wrench className="w-4 h-4" />
                    {t("Xizmatlar")}
                  </button>
                  <button
                    onClick={() => setServicePanel("products")}
                    className={servicePanel === "products" ? "toggle-group-btn toggle-group-btn-active" : "toggle-group-btn toggle-group-btn-inactive"}
                  >
                    <Package className="w-4 h-4" />
                    {t("Mahsulotlar")} ({availableProducts.length})
                  </button>
                </div>

                {servicePanel === "services" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {serviceTypes.map((st) => {
                      const inCart = cart.find((i) => i.serviceName === st.name);
                      return (
                        <button
                          key={st.id}
                          onClick={() => addServiceToCart(st.name, Number(st.priceUzs), Number(st.priceUsd))}
                          className={`pos-product-card relative ${inCart ? "!border-indigo-400 ring-2 ring-indigo-100" : ""}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <p className="font-medium text-sm text-slate-900 truncate">{st.name}</p>
                          </div>
                          <span className="currency-uzs text-sm">{formatUzs(Number(st.priceUzs))}</span>
                          {inCart && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                              {inCart.quantity}
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {/* Custom service card */}
                    <button
                      onClick={() => setCustomServiceOpen(true)}
                      className="pos-product-card border-dashed !border-slate-300 flex flex-col items-center justify-center gap-1 min-h-[72px]"
                    >
                      <Plus className="w-5 h-5 text-slate-400" />
                      <span className="text-xs text-slate-500 font-medium">{t("Boshqa xizmat")}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <SearchInput
                        placeholder={t("Mahsulot qidirish...")}
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        onClear={() => setProductSearch("")}
                      />
                    </div>
                    {productsQuery.isLoading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="pos-product-card animate-pulse">
                            <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-slate-200 rounded w-1/2" />
                          </div>
                        ))}
                      </div>
                    ) : availableProducts.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{t("Mahsulotlar topilmadi")}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {availableProducts.map((product) => (
                          <ProductCard
                            key={product.id}
                            id={product.id}
                            name={product.name}
                            code={product.code}
                            sellPriceUzs={Number(product.sellPriceUzs)}
                            stock={product.stockItems[0] ? Number(product.stockItems[0].quantity) : 0}
                            unit={product.unit.toLowerCase()}
                            thumb={product.images[0]?.filePath ?? null}
                            cartQty={cartMap.get(product.id) ?? 0}
                            onAdd={() => cartStore.addProduct({ id: product.id, name: product.name, code: product.code, categoryName: product.category?.name ?? "", unit: product.unit, sellPriceUzs: Number(product.sellPriceUzs), sellPriceUsd: Number(product.sellPriceUsd) })}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ===== RIGHT: CART ===== */}
              <div className="w-full lg:w-[400px] shrink-0">
                <div className="card sticky top-20">
                  <div className="card-header">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-semibold">{t("Savat")} ({cart.length})</h3>
                    </div>
                    {cart.length > 0 && (
                      <button onClick={() => cartStore.clear()} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                        {t("Tozalash")}
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-3 border-b border-slate-200">
                    <div className="relative">
                      <SearchInput
                        placeholder={t("Mijoz tanlash (ixtiyoriy)...")}
                        value={selectedCustomer ? selectedCustomer.fullName : customerSearch}
                        onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
                        onClear={() => { setCustomerSearch(""); setSelectedCustomer(null); setCustomerDropdownOpen(false); }}
                        onFocus={() => setCustomerDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                      />
                      {customerDropdownOpen && !selectedCustomer && (
                        <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-56 overflow-y-auto">
                          {customerSearchQuery.isLoading ? (
                            <div className="px-3 py-3 text-sm text-slate-400 text-center">{t("Yuklanmoqda...")}</div>
                          ) : !customerSearchQuery.data || customerSearchQuery.data.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-slate-400 text-center">{t("Mijoz topilmadi")}</div>
                          ) : (
                            customerSearchQuery.data.map((c) => (
                              <button
                                key={c.id}
                                className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm flex items-center gap-2 border-b border-slate-50 last:border-0 transition-colors"
                                onMouseDown={() => { setSelectedCustomer({ id: c.id, fullName: c.fullName }); setCustomerSearch(""); setCustomerDropdownOpen(false); }}
                              >
                                <User className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-700">{c.fullName}</span>
                                {c.phone && <span className="text-xs text-slate-400 ml-auto">{c.phone}</span>}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200/70">
                    {cart.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">
                        <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        {t("Xizmat yoki mahsulot tanlang")}
                      </div>
                    ) : (
                      cart.map((item, idx) => (
                        <div key={idx} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {item.serviceName ? (
                                <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              ) : (
                                <Package className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              )}
                              <span className="text-sm font-semibold text-slate-900 truncate">{item.productName}</span>
                            </div>
                            <button
                              className="text-slate-300 hover:text-red-500 p-0.5 transition-colors"
                              onClick={() => cartStore.removeItem(idx)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Master selection for service items */}
                          {item.serviceName && (
                            <div className="ml-[22px] mb-1.5">
                              <select
                                value={item.masterId ?? ""}
                                onChange={(e) => cartStore.updateMaster(idx, e.target.value ? Number(e.target.value) : null)}
                                className={`w-full text-xs py-1.5 px-2 border rounded-lg bg-white outline-none transition-colors ${
                                  !item.masterId
                                    ? "border-red-300 text-red-500 focus:border-red-400 focus:ring-1 focus:ring-red-200"
                                    : "border-slate-200 text-slate-700 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                                }`}
                              >
                                <option value="">{t("Usta tanlang")} *</option>
                                {masters.map((m) => (
                                  <option key={m.id} value={m.id}>{m.fullName}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="flex items-center gap-2 ml-[22px]">
                            <div className="pos-qty-control">
                              <button onClick={() => cartStore.updateQuantity(idx, item.quantity - 1)}>-</button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={item.quantity || ""}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "");
                                  cartStore.updateQuantity(idx, val === "" ? 0 : Number(val));
                                }}
                              />
                              <button onClick={() => cartStore.updateQuantity(idx, item.quantity + 1)}>+</button>
                            </div>
                            <span className="text-slate-300">x</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatNumber(item.priceUzs)}
                              onChange={(e) => cartStore.updatePrice(idx, "priceUzs", parseFormattedNumber(e.target.value))}
                              className="w-28 text-sm px-2 py-1 border border-slate-200 rounded-lg text-right currency-uzs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                            <span className="text-sm font-bold text-slate-800 ml-auto whitespace-nowrap">
                              {formatUzs(item.priceUzs * item.quantity)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pos-cart-total">
                    {hasUnassignedService && (
                      <div className="flex items-center gap-2 text-xs text-red-600 font-medium mb-3 bg-red-50 px-3 py-1.5 rounded-lg">
                        <UserCheck className="w-3.5 h-3.5" />
                        {t("Barcha xizmatlarga usta tanlang")}
                      </div>
                    )}
                    {hasWorkshopItems && (
                      <div className="flex items-center gap-2 text-xs text-amber-700 font-medium mb-3 bg-amber-50 px-3 py-1.5 rounded-lg">
                        <Wrench className="w-3.5 h-3.5" />
                        {t("Ustaxonaga yuboriladi")}
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-slate-500">{t("Jami")}:</span>
                      <div className="text-right">
                        <p className="text-2xl font-bold currency-uzs">{formatUzs(cartTotal.uzs)}</p>
                        {cartTotal.usd > 0 && <p className="text-sm currency-usd mt-0.5">{formatUsd(cartTotal.usd)}</p>}
                      </div>
                    </div>
                    <Input placeholder={t("Izoh...")} value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} className="mb-3" />
                    <button
                      className="btn-pos-sell"
                      disabled={cart.length === 0 || hasUnassignedService || createServiceSale.isPending}
                      onClick={() => createServiceSale.mutate()}
                    >
                      <Banknote className="w-6 h-6" />
                      {t("XIZMAT SOTISH")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          ) : (
            /* =============================================
               PRODUCT MODE — cart table
            ============================================= */
            <div className="space-y-4">
              {/* Top bar: customer search + actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 w-full sm:max-w-sm">
                  <SearchInput
                    placeholder={t("Mijoz tanlash (ixtiyoriy)...")}
                    value={selectedCustomer ? selectedCustomer.fullName : customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
                    onClear={() => { setCustomerSearch(""); setSelectedCustomer(null); setCustomerDropdownOpen(false); }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                  />
                  {customerDropdownOpen && !selectedCustomer && (
                    <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-56 overflow-y-auto">
                      {customerSearchQuery.isLoading ? (
                        <div className="px-3 py-3 text-sm text-slate-400 text-center">{t("Yuklanmoqda...")}</div>
                      ) : !customerSearchQuery.data || customerSearchQuery.data.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-slate-400 text-center">{t("Mijoz topilmadi")}</div>
                      ) : (
                        customerSearchQuery.data.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm flex items-center gap-2 border-b border-slate-50 last:border-0 transition-colors"
                            onMouseDown={() => { setSelectedCustomer({ id: c.id, fullName: c.fullName }); setCustomerSearch(""); setCustomerDropdownOpen(false); }}
                          >
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-700">{c.fullName}</span>
                            {c.phone && <span className="text-xs text-slate-400 ml-auto">{c.phone}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {cart.length > 0 && (
                    <button onClick={() => cartStore.clear()} className="text-sm text-slate-400 hover:text-red-500 transition-colors">
                      {t("Tozalash")}
                    </button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => navigate({ to: "/products", search: { fromSale: true } as Record<string, unknown> })}
                  >
                    <Plus className="w-4 h-4" />
                    {t("Mahsulot qo'shish")}
                  </Button>
                </div>
              </div>

              {/* Cart table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <tr>
                      <th className="w-8 !px-2">#</th>
                      <th>{t("Mahsulot")}</th>
                      <th>{t("Guruh")}</th>
                      <th className="text-center">{t("Birlik")}</th>
                      <th className="text-center">{t("Miqdor")}</th>
                      <th className="text-right">{t("Sotish narxi")}</th>
                      <th className="text-right">{t("Jami")}</th>
                      <th className="w-10"></th>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableEmpty
                        colSpan={8}
                        message={t("Savat bo'sh")}
                        icon={<ShoppingCart className="w-8 h-8" />}
                      />
                    ) : (
                      <>
                        {cart.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="!px-2 !py-2 text-xs text-slate-400 text-center">{idx + 1}</td>
                            <td className="!py-2">
                              <div className="min-w-0">
                                <span className="font-medium text-slate-900 text-[13px] leading-tight">{item.productName}</span>
                                {item.productCode && <span className="block text-[11px] text-slate-400 font-mono">{item.productCode}</span>}
                              </div>
                            </td>
                            <td className="!py-2">
                              {item.categoryName && (
                                <Badge variant="neutral">{item.categoryName}</Badge>
                              )}
                            </td>
                            <td className="text-center !py-2">
                              <span className="text-xs text-slate-500">{item.unit}</span>
                            </td>
                            <td className="text-center !py-2">
                              <div className="pos-qty-control inline-flex">
                                <button onClick={() => cartStore.updateQuantity(idx, item.quantity - 1)}>-</button>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={item.quantity || ""}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, "");
                                    cartStore.updateQuantity(idx, val === "" ? 0 : Number(val));
                                  }}
                                />
                                <button onClick={() => cartStore.updateQuantity(idx, item.quantity + 1)}>+</button>
                              </div>
                            </td>
                            <td className="text-right !py-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatNumber(item.priceUzs)}
                                onChange={(e) => cartStore.updatePrice(idx, "priceUzs", parseFormattedNumber(e.target.value))}
                                className="w-32 text-sm px-2 py-1 border border-slate-200 rounded-lg text-right font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                              />
                            </td>
                            <td className="text-right !py-2">
                              <span className="text-sm font-bold text-slate-800 whitespace-nowrap">
                                {formatUzs(item.priceUzs * item.quantity)}
                              </span>
                            </td>
                            <td className="!p-1 text-center">
                              <button
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                onClick={() => cartStore.removeItem(idx)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Bottom bar: total + notes + sell */}
              {cart.length > 0 && (
                <div className="card !p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1 w-full sm:w-auto">
                      <Input placeholder={t("Izoh...")} value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-xs text-slate-500">{t("Jami")}:</span>
                        <p className="text-xl font-bold text-slate-900">{formatUzs(cartTotal.uzs)}</p>
                        {cartTotal.usd > 0 && <p className="text-xs text-slate-500">{formatUsd(cartTotal.usd)}</p>}
                      </div>
                      <Button
                        variant="success"
                        onClick={openPaymentModal}
                        disabled={cart.length === 0}
                        className="!px-6 !py-2.5"
                      >
                        <Banknote className="w-5 h-5" />
                        {t("SOTISH")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* ===== HISTORY ===== */
          <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <tr>
                <th>{t("Hujjat")}</th>
                <th className="hidden sm:table-cell">{t("Sana")}</th>
                <th className="hidden md:table-cell">{t("Mijoz")}</th>
                <th className="hidden sm:table-cell">{t("Turi")}</th>
                <th>{t("Summa")}</th>
                <th>{t("Holat")}</th>
                <th className="w-28">{t("Amallar")}</th>
              </tr>
            </TableHead>
            <TableBody>
              {salesQuery.isLoading ? (
                <TableLoading colSpan={7} />
              ) : sales.length === 0 ? (
                <TableEmpty colSpan={7} message={t("Sotuvlar yo'q")} />
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <td className="font-mono text-xs">{sale.documentNo}</td>
                    <td className="text-sm text-slate-500 hidden sm:table-cell">{new Date(sale.createdAt).toLocaleString("uz")}</td>
                    <td className="hidden md:table-cell">{sale.customer?.fullName || t("Oddiy mijoz")}</td>
                    <td className="hidden sm:table-cell">
                      <Badge variant={sale.saleType === "PRODUCT" ? "info" : "warning"}>
                        {sale.saleType === "PRODUCT" ? t("Savdo") : t("Xizmat")}
                      </Badge>
                    </td>
                    <td><CurrencyDisplay amountUzs={sale.totalUzs} amountUsd={sale.totalUsd} size="sm" /></td>
                    <td><StatusBadge status={sale.status} /></td>
                    <td>
                      <div className="flex items-center gap-1">
                        {sale.status === "OPEN" && (
                          <>
                            <button
                              className="p-1.5 hover:bg-green-50 rounded-md transition-colors"
                              title={t("Yakunlash")}
                              onClick={() => {
                                setPaymentSaleId(sale.id);
                                setPaymentSaleTotal(Number(sale.totalUzs));
                                setPaymentCustomerId(sale.customerId ?? undefined);
                                setPaymentForm({ cashUzs: String(sale.totalUzs), cardUzs: "0" });
                                setPaymentOpen(true);
                              }}
                            >
                              <Banknote className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                              title={t("Bekor qilish")}
                              onClick={() => { if (confirm(getT()("Bu sotuvni bekor qilmoqchimisiz?"))) cancelSale.mutate(sale.id); }}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title={t("To'lov qabul qilish")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>{t("Bekor")}</Button>
            <Button
              variant="success"
              loading={confirmSale.isPending}
              onClick={() => {
                const cash = Number(paymentForm.cashUzs);
                const card = Number(paymentForm.cardUzs);
                const debtUzs = Math.max(0, paymentSaleTotal - cash - card);
                if (debtUzs > 0 && !paymentCustomerId) {
                  toast.error(getT()("Mijoz tanlanmagan — summa to'liq bo'lishi kerak"));
                  return;
                }
                confirmSale.mutate();
              }}
            >
              <Check className="w-4 h-4" /> {t("To'lovni tasdiqlash")}
            </Button>
          </>
        }
      >
        {(() => {
          const cash = Number(paymentForm.cashUzs);
          const card = Number(paymentForm.cardUzs);
          const debtUzs = Math.max(0, paymentSaleTotal - cash - card);
          return (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-slate-500">{t("Jami summa")}</span>
                <span className="font-bold text-base">{formatUzs(paymentSaleTotal)}</span>
              </div>
              <Input
                label={t("Naqd")}
                type="text"
                inputMode="numeric"
                value={formatNumber(paymentForm.cashUzs)}
                onChange={(e) => setPaymentForm((f) => ({ ...f, cashUzs: String(parseFormattedNumber(e.target.value)) }))}
                rightIcon={<span className="text-xs">so'm</span>}
              />
              <Input
                label={t("Karta")}
                type="text"
                inputMode="numeric"
                value={formatNumber(paymentForm.cardUzs)}
                onChange={(e) => setPaymentForm((f) => ({ ...f, cardUzs: String(parseFormattedNumber(e.target.value)) }))}
                rightIcon={<span className="text-xs">so'm</span>}
              />
              {paymentCustomerId ? (
                <div className={`flex justify-between items-center px-4 py-3 rounded-lg border ${debtUzs > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                  <span className={`text-sm font-medium ${debtUzs > 0 ? "text-amber-700" : "text-green-700"}`}>{t("Qarzga")}</span>
                  <span className={`font-bold ${debtUzs > 0 ? "text-amber-600" : "text-green-600"}`}>{formatUzs(debtUzs)}</span>
                </div>
              ) : debtUzs > 0 ? (
                <div className="flex justify-between items-center px-4 py-3 rounded-lg border bg-red-50 border-red-200">
                  <span className="text-sm font-medium text-red-700">{t("Yetmayapti")}</span>
                  <span className="font-bold text-red-600">{formatUzs(debtUzs)}</span>
                </div>
              ) : null}
            </div>
          );
        })()}
      </Modal>

      {/* Custom service modal */}
      <Modal
        open={customServiceOpen}
        onClose={() => setCustomServiceOpen(false)}
        title={t("Boshqa xizmat qo'shish")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCustomServiceOpen(false)}>{t("Bekor")}</Button>
            <Button onClick={() => {
              if (!customServiceForm.name.trim()) { toast.error(getT()("Xizmat nomini kiriting")); return; }
              if (!Number(customServiceForm.price)) { toast.error(getT()("Narxni kiriting")); return; }
              addServiceToCart(customServiceForm.name, Number(customServiceForm.price), 0);
              setCustomServiceForm({ name: "", price: "" });
              setCustomServiceOpen(false);
            }}>
              <Plus className="w-4 h-4" /> {t("Qo'shish")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label={t("Xizmat nomi")} value={customServiceForm.name} onChange={(e) => setCustomServiceForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("Masalan: Maxsus kesish")} />
          <Input label={t("Narx (UZS)")} type="text" inputMode="numeric" value={formatNumber(customServiceForm.price)} onChange={(e) => setCustomServiceForm((f) => ({ ...f, price: String(parseFormattedNumber(e.target.value)) }))} placeholder="0" />
        </div>
      </Modal>
    </div>
  );
}

// ===== Memoized Product Card (prevents re-render on cart/search changes) =====
interface ProductCardProps {
  id: number;
  name: string;
  code: string;
  sellPriceUzs: number;
  stock: number;
  unit: string;
  thumb: string | null;
  cartQty: number;
  onAdd: () => void;
}

const ProductCard = memo(function ProductCard({ name, code, sellPriceUzs, stock, unit, thumb, cartQty, onAdd }: ProductCardProps) {
  return (
    <button
      onClick={onAdd}
      disabled={stock <= 0}
      className={`pos-product-card relative text-left ${cartQty > 0 ? "!border-indigo-400 ring-2 ring-indigo-100" : ""}`}
    >
      <div className="h-20 rounded-md overflow-hidden bg-slate-100 mb-1.5">
        {thumb ? (
          <img src={thumb} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-6 h-6 text-slate-300" />
          </div>
        )}
      </div>
      <p className="font-medium text-sm text-slate-900 truncate">{name}</p>
      {code && <p className="text-[10px] text-slate-400 truncate">#{code}</p>}
      <div className="flex items-center justify-between mt-0.5">
        <span className="currency-uzs text-sm">{formatUzs(sellPriceUzs)}</span>
        <span className={`text-xs font-medium ${stock <= 0 ? "text-red-500" : stock < 10 ? "text-amber-500" : "text-slate-400"}`}>
          {stock} {unit}
        </span>
      </div>
      {cartQty > 0 && (
        <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
          {cartQty}
        </div>
      )}
    </button>
  );
});
