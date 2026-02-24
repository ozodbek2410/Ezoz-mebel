import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import {
  Plus, ShoppingCart, Trash2, Check, X,
  User, Package, Banknote, Wrench, Loader2, UserCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Button, Modal, Input, Select, CurrencyPairInput, SearchInput,
  Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading,
  Badge, Tabs,
} from "@/components/ui";
import { CurrencyDisplay, StatusBadge } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { useT, getT } from "@/hooks/useT";
import { formatUzs, formatUsd } from "@ezoz/shared";
import toast from "react-hot-toast";

interface CartItem {
  productId: number | null;
  productName: string;
  serviceName: string | null;
  quantity: number;
  priceUzs: number;
  priceUsd: number;
  masterId: number | null;
}

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

  const [activeTab, setActiveTab] = useState("pos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; fullName: string } | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  // Service mode
  const [servicePanel, setServicePanel] = useState<"services" | "products">("services");

  // Payment
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSaleId, setPaymentSaleId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentType: "CASH_UZS",
    amountUzs: "0",
    amountUsd: "0",
    notes: "",
  });

  // Warehouse auto-detect
  const warehousesQuery = useQuery({
    queryKey: ["warehouse", "list"],
    queryFn: () => trpc.warehouse.listWarehouses.query(),
  });
  const warehouses = warehousesQuery.data ?? [];
  const targetWarehouse = warehouses.find((w) =>
    isServiceMode ? w.name === "Sex" : w.name === "Asosiy ombor",
  );

  // Service types
  const serviceTypesQuery = useQuery({
    queryKey: ["serviceType", "list"],
    queryFn: () => trpc.serviceType.list.query(),
    enabled: isServiceMode,
  });
  const serviceTypes = serviceTypesQuery.data ?? [];

  // Masters
  const usersQuery = useQuery({
    queryKey: ["auth", "getUsers"],
    queryFn: () => trpc.auth.getUsers.query(),
    enabled: isServiceMode,
  });
  const masters = (usersQuery.data ?? []).filter((u) => u.role === "MASTER");

  // Products
  const productsQuery = useQuery({
    queryKey: ["product", "list", productSearch, targetWarehouse?.id],
    queryFn: () =>
      trpc.product.list.query({
        search: productSearch || undefined,
        warehouseId: targetWarehouse?.id,
        limit: 1000,
      }),
    enabled: activeTab === "pos" && !!targetWarehouse,
  });

  const customerSearchQuery = useQuery({
    queryKey: ["customer", "search", customerSearch],
    queryFn: () => trpc.customer.search.query({ query: customerSearch }),
    enabled: customerSearch.length >= 2,
  });

  const salesQuery = useQuery({
    queryKey: ["sale", "list", saleType],
    queryFn: () => trpc.sale.list.query({ saleType }),
    enabled: activeTab === "history",
  });

  const hasWorkshopItems = cart.some((item) => item.serviceName && item.masterId);
  const hasUnassignedService = cart.some((item) => item.serviceName && !item.masterId);

  // Mutations
  const createSale = useMutation({
    mutationFn: () =>
      trpc.sale.create.mutate({
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
      }),
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      setCart([]);
      setSelectedCustomer(null);
      setSaleNotes("");
      toast.success(getT()(`Sotuv #${sale.documentNo} yaratildi`));
      setPaymentSaleId(sale.id);
      setPaymentForm({ paymentType: "CASH_UZS", amountUzs: String(sale.totalUzs), amountUsd: "0", notes: "" });
      setPaymentOpen(true);
    },
    onError: (err) => toast.error(err.message),
  });

  const completeSale = useMutation({
    mutationFn: (id: number) => trpc.sale.complete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success(getT()("Sotuv yakunlandi"));
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

  const createPayment = useMutation({
    mutationFn: () =>
      trpc.payment.create.mutate({
        saleId: paymentSaleId ?? undefined,
        customerId: selectedCustomer?.id,
        amountUzs: Number(paymentForm.amountUzs),
        amountUsd: Number(paymentForm.amountUsd),
        paymentType: paymentForm.paymentType as "CASH_UZS" | "CASH_USD" | "CARD" | "TRANSFER" | "DEBT",
        source: "NEW_SALE",
        notes: paymentForm.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      setPaymentOpen(false);
      setPaymentSaleId(null);
      if (paymentSaleId) completeSale.mutate(paymentSaleId);
      toast.success(getT()("To'lov qabul qilindi"));
    },
    onError: (err) => toast.error(err.message),
  });

  // Cart
  const addToCart = useCallback(
    (product: NonNullable<typeof productsQuery.data>["items"][number]) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          return prev.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
          );
        }
        return [...prev, {
          productId: product.id,
          productName: product.name,
          serviceName: null,
          quantity: 1,
          priceUzs: Number(product.sellPriceUzs),
          priceUsd: Number(product.sellPriceUsd),
          masterId: null,
        }];
      });
    },
    [],
  );

  function addServiceToCart(name: string, uzs: number, usd: number) {
    setCart((prev) => {
      const existing = prev.find((i) => i.serviceName === name);
      if (existing) {
        return prev.map((i) => i.serviceName === name ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        productId: null,
        productName: name,
        serviceName: name,
        quantity: 1,
        priceUzs: uzs,
        priceUsd: usd,
        masterId: null,
      }];
    });
  }

  // Custom service modal
  const [customServiceOpen, setCustomServiceOpen] = useState(false);
  const [customServiceForm, setCustomServiceForm] = useState({ name: "", price: "" });

  const updateCartQuantity = (index: number, qty: number) => {
    if (qty <= 0) setCart((prev) => prev.filter((_, i) => i !== index));
    else setCart((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item)));
  };

  const updateCartPrice = (index: number, field: "priceUzs" | "priceUsd", value: number) => {
    setCart((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const updateCartMaster = (index: number, masterId: number | null) => {
    setCart((prev) => prev.map((item, i) => (i === index ? { ...item, masterId } : item)));
  };

  const cartTotal = cart.reduce(
    (acc, item) => ({ uzs: acc.uzs + item.priceUzs * item.quantity, usd: acc.usd + item.priceUsd * item.quantity }),
    { uzs: 0, usd: 0 },
  );

  const products = productsQuery.data?.items ?? [];
  const availableProducts = products.filter((p) => {
    const stock = p.stockItems[0] ? Number(p.stockItems[0].quantity) : 0;
    return stock > 0;
  });
  const sales = salesQuery.data?.sales ?? [];

  function getMasterName(id: number | null) {
    if (!id) return null;
    return masters.find((m) => m.id === id)?.fullName ?? null;
  }

  // ===================== RENDER =====================
  return (
    <>
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
                <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setServicePanel("services")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      servicePanel === "services" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    {t("Xizmatlar")}
                  </button>
                  <button
                    onClick={() => setServicePanel("products")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      servicePanel === "products" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    {t("Mahsulotlar")} ({availableProducts.length})
                  </button>
                </div>

                {servicePanel === "services" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {serviceTypes.map((st) => {
                      const inCart = cart.find((i) => i.serviceName === st.name);
                      return (
                        <button
                          key={st.id}
                          onClick={() => addServiceToCart(st.name, Number(st.priceUzs), Number(st.priceUsd))}
                          className={`pos-product-card relative ${inCart ? "!border-amber-400 ring-2 ring-amber-100" : ""}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <p className="font-medium text-sm text-gray-900 truncate">{st.name}</p>
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
                      className="pos-product-card border-dashed !border-gray-300 flex flex-col items-center justify-center gap-1 min-h-[72px]"
                    >
                      <Plus className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-500 font-medium">{t("Boshqa xizmat")}</span>
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="pos-product-card animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                          </div>
                        ))}
                      </div>
                    ) : availableProducts.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{t("Mahsulotlar topilmadi")}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {availableProducts.map((product) => {
                          const stock = product.stockItems[0] ? Number(product.stockItems[0].quantity) : 0;
                          const inCart = cart.find((i) => i.productId === product.id);
                          return (
                            <button
                              key={product.id}
                              onClick={() => addToCart(product)}
                              className={`pos-product-card relative ${inCart ? "!border-brand-400 ring-2 ring-brand-100" : ""}`}
                            >
                              <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="currency-uzs text-sm">{formatUzs(Number(product.sellPriceUzs))}</span>
                                <span className="text-xs text-gray-400">{stock} {product.unit.toLowerCase()}</span>
                              </div>
                              {inCart && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-brand-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                                  {inCart.quantity}
                                </div>
                              )}
                            </button>
                          );
                        })}
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
                      <ShoppingCart className="w-5 h-5 text-brand-600" />
                      <h3 className="font-semibold">{t("Savat")} ({cart.length})</h3>
                    </div>
                    {cart.length > 0 && (
                      <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                        {t("Tozalash")}
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="relative">
                      <SearchInput
                        placeholder={t("Mijoz tanlash (ixtiyoriy)...")}
                        value={selectedCustomer ? selectedCustomer.fullName : customerSearch}
                        onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
                        onClear={() => { setCustomerSearch(""); setSelectedCustomer(null); }}
                      />
                      {!selectedCustomer && customerSearch.length >= 2 && customerSearchQuery.data && (
                        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border max-h-40 overflow-y-auto">
                          {customerSearchQuery.data.map((c) => (
                            <button
                              key={c.id}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                              onClick={() => { setSelectedCustomer({ id: c.id, fullName: c.fullName }); setCustomerSearch(""); }}
                            >
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span>{c.fullName}</span>
                              {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {cart.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">
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
                                <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              )}
                              <span className="text-sm font-semibold text-gray-900 truncate">{item.productName}</span>
                            </div>
                            <button
                              className="text-gray-300 hover:text-red-500 p-0.5 transition-colors"
                              onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Master selection for service items */}
                          {item.serviceName && (
                            <div className="ml-[22px] mb-1.5">
                              <select
                                value={item.masterId ?? ""}
                                onChange={(e) => updateCartMaster(idx, e.target.value ? Number(e.target.value) : null)}
                                className={`w-full text-xs py-1.5 px-2 border rounded-lg bg-white outline-none transition-colors ${
                                  !item.masterId
                                    ? "border-red-300 text-red-500 focus:border-red-400 focus:ring-1 focus:ring-red-200"
                                    : "border-gray-200 text-gray-700 focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
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
                              <button onClick={() => updateCartQuantity(idx, item.quantity - 1)}>-</button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateCartQuantity(idx, Number(e.target.value))}
                              />
                              <button onClick={() => updateCartQuantity(idx, item.quantity + 1)}>+</button>
                            </div>
                            <span className="text-gray-300">x</span>
                            <input
                              type="number"
                              value={item.priceUzs}
                              onChange={(e) => updateCartPrice(idx, "priceUzs", Number(e.target.value))}
                              className="w-24 text-sm px-2 py-1 border border-gray-200 rounded-lg text-right currency-uzs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                            />
                            <span className="text-sm font-bold text-gray-800 ml-auto whitespace-nowrap">
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
                      <span className="text-sm text-gray-500">{t("Jami")}:</span>
                      <div className="text-right">
                        <p className="text-2xl font-bold currency-uzs">{formatUzs(cartTotal.uzs)}</p>
                        {cartTotal.usd > 0 && <p className="text-sm currency-usd mt-0.5">{formatUsd(cartTotal.usd)}</p>}
                      </div>
                    </div>
                    <Input placeholder={t("Izoh...")} value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} className="mb-3" />
                    <button
                      className="btn-pos-sell"
                      disabled={cart.length === 0 || hasUnassignedService || createSale.isPending}
                      onClick={() => createSale.mutate()}
                    >
                      {createSale.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-6 h-6" />}
                      {t("XIZMAT SOTISH")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          ) : (
            /* =============================================
               PRODUCT MODE — horizontal layout (unchanged)
            ============================================= */
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
              <div className="flex-1 min-w-0">
                <div className="mb-4">
                  <SearchInput
                    placeholder={t("Mahsulot qidirish...")}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onClear={() => setProductSearch("")}
                  />
                </div>
                {productsQuery.isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="pos-product-card animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {products.map((product) => {
                      const stock = product.stockItems[0] ? Number(product.stockItems[0].quantity) : 0;
                      const inCart = cart.find((i) => i.productId === product.id);
                      return (
                        <button
                          key={product.id}
                          onClick={() => { if (stock > 0) addToCart(product); }}
                          disabled={stock <= 0}
                          className={`pos-product-card relative ${inCart ? "!border-brand-400 ring-2 ring-brand-100" : ""}`}
                        >
                          <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="currency-uzs text-sm">{formatUzs(Number(product.sellPriceUzs))}</span>
                            <span className={`text-xs ${stock <= 0 ? "text-red-500 font-medium" : "text-gray-400"}`}>
                              {stock} {product.unit.toLowerCase()}
                            </span>
                          </div>
                          {inCart && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-brand-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                              {inCart.quantity}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT: CART (product mode) */}
              <div className="w-full lg:w-[400px] shrink-0">
                <div className="card sticky top-20">
                  <div className="card-header">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-brand-600" />
                      <h3 className="font-semibold">{t("Savat")} ({cart.length})</h3>
                    </div>
                    {cart.length > 0 && (
                      <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                        {t("Tozalash")}
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="relative">
                      <SearchInput
                        placeholder={t("Mijoz tanlash (ixtiyoriy)...")}
                        value={selectedCustomer ? selectedCustomer.fullName : customerSearch}
                        onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
                        onClear={() => { setCustomerSearch(""); setSelectedCustomer(null); }}
                      />
                      {!selectedCustomer && customerSearch.length >= 2 && customerSearchQuery.data && (
                        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border max-h-40 overflow-y-auto">
                          {customerSearchQuery.data.map((c) => (
                            <button
                              key={c.id}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                              onClick={() => { setSelectedCustomer({ id: c.id, fullName: c.fullName }); setCustomerSearch(""); }}
                            >
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span>{c.fullName}</span>
                              {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {cart.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        {t("Savat bo'sh")}
                      </div>
                    ) : (
                      cart.map((item, idx) => (
                        <div key={idx} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="text-sm font-semibold text-gray-900 truncate">{item.productName}</span>
                            </div>
                            <button
                              className="text-gray-300 hover:text-red-500 p-0.5 transition-colors"
                              onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 ml-[22px]">
                            <div className="pos-qty-control">
                              <button onClick={() => updateCartQuantity(idx, item.quantity - 1)}>-</button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateCartQuantity(idx, Number(e.target.value))}
                              />
                              <button onClick={() => updateCartQuantity(idx, item.quantity + 1)}>+</button>
                            </div>
                            <span className="text-gray-300">x</span>
                            <input
                              type="number"
                              value={item.priceUzs}
                              onChange={(e) => updateCartPrice(idx, "priceUzs", Number(e.target.value))}
                              className="w-24 text-sm px-2 py-1 border border-gray-200 rounded-lg text-right currency-uzs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                            />
                            <span className="text-sm font-bold text-gray-800 ml-auto whitespace-nowrap">
                              {formatUzs(item.priceUzs * item.quantity)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pos-cart-total">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-500">{t("Jami")}:</span>
                      <div className="text-right">
                        <p className="text-2xl font-bold currency-uzs">{formatUzs(cartTotal.uzs)}</p>
                        {cartTotal.usd > 0 && <p className="text-sm currency-usd mt-0.5">{formatUsd(cartTotal.usd)}</p>}
                      </div>
                    </div>
                    <Input placeholder={t("Izoh...")} value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} className="mb-3" />
                    <button
                      className="btn-pos-sell"
                      disabled={cart.length === 0 || createSale.isPending}
                      onClick={() => createSale.mutate()}
                    >
                      {createSale.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-6 h-6" />}
                      {t("SOTISH")}
                    </button>
                  </div>
                </div>
              </div>
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
                    <td className="text-sm text-gray-500 hidden sm:table-cell">{new Date(sale.createdAt).toLocaleString("uz")}</td>
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
                              className="p-1.5 hover:bg-green-50 rounded-lg"
                              title={t("Yakunlash")}
                              onClick={() => {
                                setPaymentSaleId(sale.id);
                                setPaymentForm({ paymentType: "CASH_UZS", amountUzs: String(sale.totalUzs), amountUsd: "0", notes: "" });
                                setPaymentOpen(true);
                              }}
                            >
                              <Banknote className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              className="p-1.5 hover:bg-red-50 rounded-lg"
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
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>{t("Keyinroq")}</Button>
            <Button
              variant="success"
              loading={createPayment.isPending}
              onClick={() => {
                if (Number(paymentForm.amountUzs) <= 0 && Number(paymentForm.amountUsd) <= 0) { toast.error(getT()("Summani kiriting")); return; }
                createPayment.mutate();
              }}
            >
              <Check className="w-4 h-4" /> {t("To'lovni tasdiqlash")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t("To'lov turi")}
            options={[
              { value: "CASH_UZS", label: t("Naqd (UZS)") },
              { value: "CASH_USD", label: t("Naqd (USD)") },
              { value: "CARD", label: t("Karta") },
              { value: "TRANSFER", label: t("O'tkazma") },
              { value: "DEBT", label: t("Qarzga") },
            ]}
            value={paymentForm.paymentType}
            onChange={(e) => setPaymentForm((f) => ({ ...f, paymentType: e.target.value }))}
          />
          <CurrencyPairInput
            label={t("Summa")}
            valueUzs={paymentForm.amountUzs}
            valueUsd={paymentForm.amountUsd}
            onChangeUzs={(v) => setPaymentForm((f) => ({ ...f, amountUzs: v }))}
            onChangeUsd={(v) => setPaymentForm((f) => ({ ...f, amountUsd: v }))}
          />
          <Input label={t("Izoh")} value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
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
          <Input label={t("Narx (UZS)")} type="number" value={customServiceForm.price} onChange={(e) => setCustomServiceForm((f) => ({ ...f, price: e.target.value }))} placeholder="0" />
        </div>
      </Modal>
    </>
  );
}

