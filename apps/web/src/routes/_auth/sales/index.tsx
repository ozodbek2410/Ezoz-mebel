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
  Button, Modal, Input, Select, CurrencyInput, SearchInput,
  Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading,
  Badge, Tabs,
} from "@/components/ui";
import { CurrencyDisplay, StatusBadge } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
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
  const firstMasterId = cart.find((item) => item.masterId)?.masterId ?? null;

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
        })),
        goesToWorkshop: hasWorkshopItems,
        assignedToId: firstMasterId ?? undefined,
        notes: saleNotes || undefined,
      }),
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      setCart([]);
      setSelectedCustomer(null);
      setSaleNotes("");
      toast.success(`Sotuv #${sale.documentNo} yaratildi`);
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
      toast.success("Sotuv yakunlandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelSale = useMutation({
    mutationFn: (id: number) => trpc.sale.cancel.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      toast.success("Sotuv bekor qilindi");
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
      toast.success("To'lov qabul qilindi");
    },
    onError: (err) => toast.error(err.message),
  });

  // Cart
  const addToCart = useCallback(
    (product: NonNullable<typeof productsQuery.data>[number]) => {
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

  function addServiceItem(name: string, uzs: number, usd: number, qty: number, masterId: number | null) {
    if (!name || uzs <= 0) {
      toast.error("Xizmat nomi va narxni kiriting");
      return;
    }
    setCart((prev) => [...prev, {
      productId: null,
      productName: name,
      serviceName: name,
      quantity: qty || 1,
      priceUzs: uzs,
      priceUsd: usd,
      masterId,
    }]);
  }

  const updateCartQuantity = (index: number, qty: number) => {
    if (qty <= 0) setCart((prev) => prev.filter((_, i) => i !== index));
    else setCart((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item)));
  };

  const updateCartPrice = (index: number, field: "priceUzs" | "priceUsd", value: number) => {
    setCart((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const cartTotal = cart.reduce(
    (acc, item) => ({ uzs: acc.uzs + item.priceUzs * item.quantity, usd: acc.usd + item.priceUsd * item.quantity }),
    { uzs: 0, usd: 0 },
  );

  const products = productsQuery.data ?? [];
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
        title={isServiceMode ? "Xizmat kassasi" : "Savdo kassasi"}
        actions={
          <Tabs
            tabs={[{ id: "pos", label: "Kassa" }, { id: "history", label: "Tarix" }]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        }
      />

      <div className="page-body">
        {activeTab === "pos" ? (
          isServiceMode ? (
            /* =============================================
               SERVICE MODE — vertical layout:
               TOP: Cart (full width)
               BOTTOM: Services / Products tabs
            ============================================= */
            <div className="space-y-5">
              {/* ===== TOP: CART ===== */}
              <div className="card overflow-hidden">
                {/* Cart header + Customer */}
                <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 shrink-0">
                    <ShoppingCart className="w-5 h-5 text-brand-600" />
                    <h3 className="font-semibold text-gray-900">Savat</h3>
                    {cart.length > 0 && (
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">{cart.length}</span>
                    )}
                  </div>
                  <div className="flex-1 max-w-xs relative">
                    <SearchInput
                      placeholder="Mijoz tanlash..."
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
                  <div className="ml-auto flex items-center gap-3">
                    {cart.length > 0 && (
                      <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                        Tozalash
                      </button>
                    )}
                  </div>
                </div>

                {/* Cart items — horizontal table */}
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Pastdagi xizmat yoki mahsulotni qo'shing
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Nomi</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase w-[120px]">Usta</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase w-[100px]">Soni</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-[130px]">Narx</th>
                          <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase w-[130px]">Jami</th>
                          <th className="w-[40px]" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cart.map((item, idx) => {
                          const masterName = getMasterName(item.masterId);
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {item.serviceName ? (
                                    <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  ) : (
                                    <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                  )}
                                  <span className="font-medium text-gray-900 truncate">{item.productName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                {masterName ? (
                                  <span className="text-xs text-brand-600 font-medium flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    {masterName}
                                  </span>
                                ) : item.serviceName ? (
                                  <span className="text-xs text-gray-400 italic">—</span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="pos-qty-control mx-auto">
                                  <button onClick={() => updateCartQuantity(idx, item.quantity - 1)}>-</button>
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => updateCartQuantity(idx, Number(e.target.value))}
                                  />
                                  <button onClick={() => updateCartQuantity(idx, item.quantity + 1)}>+</button>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <input
                                  type="number"
                                  value={item.priceUzs}
                                  onChange={(e) => updateCartPrice(idx, "priceUzs", Number(e.target.value))}
                                  className="w-28 text-sm px-2 py-1 border border-gray-200 rounded-lg text-right currency-uzs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="font-bold text-gray-900 whitespace-nowrap currency-uzs">
                                  {formatUzs(item.priceUzs * item.quantity)}
                                </span>
                              </td>
                              <td className="pr-3 py-2.5">
                                <button
                                  className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                                  onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer: workshop indicator + total + sell button */}
                {cart.length > 0 && (
                  <div className="border-t border-gray-200 bg-gray-50/50 px-5 py-3">
                    {hasWorkshopItems && (
                      <div className="flex items-center gap-2 text-xs text-amber-700 font-medium mb-3 bg-amber-50 px-3 py-1.5 rounded-lg w-fit">
                        <Wrench className="w-3.5 h-3.5" />
                        Ustaxonaga yuboriladi
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <Input
                        placeholder="Izoh..."
                        value={saleNotes}
                        onChange={(e) => setSaleNotes(e.target.value)}
                        className="flex-1 max-w-xs"
                      />
                      <div className="ml-auto flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Jami</p>
                          <p className="text-xl font-bold currency-uzs">{formatUzs(cartTotal.uzs)}</p>
                          {cartTotal.usd > 0 && <p className="text-xs currency-usd">{formatUsd(cartTotal.usd)}</p>}
                        </div>
                        <button
                          className="btn-pos-sell !py-3 !px-8"
                          disabled={cart.length === 0 || createSale.isPending}
                          onClick={() => createSale.mutate()}
                        >
                          {createSale.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-5 h-5" />}
                          XIZMAT SOTISH
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== BOTTOM: Services / Products tabs ===== */}
              <div>
                <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setServicePanel("services")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      servicePanel === "services" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    Xizmatlar
                  </button>
                  <button
                    onClick={() => setServicePanel("products")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      servicePanel === "products" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    Mahsulotlar ({availableProducts.length})
                  </button>
                </div>

                {servicePanel === "services" ? (
                  <div className="card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Xizmat</th>
                          <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[130px]">Narx</th>
                          <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[180px]">Usta</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[80px]">Soni</th>
                          <th className="w-[50px]" />
                        </tr>
                      </thead>
                      <tbody>
                        {serviceTypes.map((st) => (
                          <ServiceRow
                            key={st.id}
                            name={st.name}
                            priceUzs={Number(st.priceUzs)}
                            priceUsd={Number(st.priceUsd)}
                            masters={masters}
                            onAdd={(masterId, qty) => addServiceItem(st.name, Number(st.priceUzs), Number(st.priceUsd), qty, masterId)}
                          />
                        ))}
                        <CustomServiceRow
                          masters={masters}
                          onAdd={(name, uzs, masterId, qty) => addServiceItem(name, uzs, 0, qty, masterId)}
                        />
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <SearchInput
                        placeholder="Mahsulot qidirish..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        onClear={() => setProductSearch("")}
                      />
                    </div>
                    {productsQuery.isLoading ? (
                      <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="pos-product-card animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                          </div>
                        ))}
                      </div>
                    ) : availableProducts.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Mahsulotlar topilmadi</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
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
            </div>
          ) : (
            /* =============================================
               PRODUCT MODE — horizontal layout (unchanged)
            ============================================= */
            <div className="flex gap-6">
              <div className="flex-1 min-w-0">
                <div className="mb-4">
                  <SearchInput
                    placeholder="Mahsulot qidirish..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onClear={() => setProductSearch("")}
                  />
                </div>
                {productsQuery.isLoading ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="pos-product-card animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
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
              <div className="w-[400px] shrink-0">
                <div className="card sticky top-20">
                  <div className="card-header">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-brand-600" />
                      <h3 className="font-semibold">Savat ({cart.length})</h3>
                    </div>
                    {cart.length > 0 && (
                      <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                        Tozalash
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="relative">
                      <SearchInput
                        placeholder="Mijoz tanlash (ixtiyoriy)..."
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

                  <div className="max-h-[calc(100vh-480px)] overflow-y-auto divide-y divide-gray-100">
                    {cart.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        Savat bo'sh
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
                      <span className="text-sm text-gray-500">Jami:</span>
                      <div className="text-right">
                        <p className="text-2xl font-bold currency-uzs">{formatUzs(cartTotal.uzs)}</p>
                        {cartTotal.usd > 0 && <p className="text-sm currency-usd mt-0.5">{formatUsd(cartTotal.usd)}</p>}
                      </div>
                    </div>
                    <Input placeholder="Izoh..." value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} className="mb-3" />
                    <button
                      className="btn-pos-sell"
                      disabled={cart.length === 0 || createSale.isPending}
                      onClick={() => createSale.mutate()}
                    >
                      {createSale.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-6 h-6" />}
                      SOTISH
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          /* ===== HISTORY ===== */
          <Table>
            <TableHead>
              <tr>
                <th>Hujjat</th>
                <th>Sana</th>
                <th>Mijoz</th>
                <th>Turi</th>
                <th>Summa</th>
                <th>Holat</th>
                <th className="w-28">Amallar</th>
              </tr>
            </TableHead>
            <TableBody>
              {salesQuery.isLoading ? (
                <TableLoading colSpan={7} />
              ) : sales.length === 0 ? (
                <TableEmpty colSpan={7} message="Sotuvlar yo'q" />
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <td className="font-mono text-xs">{sale.documentNo}</td>
                    <td className="text-sm text-gray-500">{new Date(sale.createdAt).toLocaleString("uz")}</td>
                    <td>{sale.customer?.fullName || "-"}</td>
                    <td>
                      <Badge variant={sale.saleType === "PRODUCT" ? "info" : "warning"}>
                        {sale.saleType === "PRODUCT" ? "Savdo" : "Xizmat"}
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
                              title="Yakunlash"
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
                              title="Bekor qilish"
                              onClick={() => { if (confirm("Bu sotuvni bekor qilmoqchimisiz?")) cancelSale.mutate(sale.id); }}
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
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="To'lov qabul qilish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>Keyinroq</Button>
            <Button
              variant="success"
              loading={createPayment.isPending}
              onClick={() => {
                if (Number(paymentForm.amountUzs) <= 0 && Number(paymentForm.amountUsd) <= 0) { toast.error("Summani kiriting"); return; }
                createPayment.mutate();
              }}
            >
              <Check className="w-4 h-4" /> To'lovni tasdiqlash
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="To'lov turi"
            options={[
              { value: "CASH_UZS", label: "Naqd (UZS)" },
              { value: "CASH_USD", label: "Naqd (USD)" },
              { value: "CARD", label: "Karta" },
              { value: "TRANSFER", label: "O'tkazma" },
              { value: "DEBT", label: "Qarzga" },
            ]}
            value={paymentForm.paymentType}
            onChange={(e) => setPaymentForm((f) => ({ ...f, paymentType: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput label="Summa (UZS)" currency="UZS" value={paymentForm.amountUzs} onValueChange={(v) => setPaymentForm((f) => ({ ...f, amountUzs: v }))} />
            <CurrencyInput label="Summa (USD)" currency="USD" value={paymentForm.amountUsd} onValueChange={(v) => setPaymentForm((f) => ({ ...f, amountUsd: v }))} />
          </div>
          <Input label="Izoh" value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>
    </>
  );
}

// ===== SERVICE ROW =====

interface ServiceRowProps {
  name: string;
  priceUzs: number;
  priceUsd: number;
  masters: Array<{ id: number; fullName: string }>;
  onAdd: (masterId: number | null, qty: number) => void;
}

function ServiceRow({ name, priceUzs, priceUsd, masters, onAdd }: ServiceRowProps) {
  const [masterId, setMasterId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);

  function handleAdd() {
    onAdd(masterId, qty);
    setQty(1);
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-medium text-gray-900">{name}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className="currency-uzs text-sm">{formatUzs(priceUzs)}</span>
      </td>
      <td className="px-3 py-2.5">
        <select
          value={masterId ?? ""}
          onChange={(e) => setMasterId(e.target.value ? Number(e.target.value) : null)}
          className="w-full text-sm py-1 px-2 border border-gray-200 rounded-lg bg-white text-gray-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
        >
          <option value="">Tanlanmagan</option>
          {masters.map((m) => (
            <option key={m.id} value={m.id}>{m.fullName}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5 text-center">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 1)}
          min={1}
          className="w-14 text-sm text-center py-1 border border-gray-200 rounded-lg outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
        />
      </td>
      <td className="px-3 py-2.5">
        <button
          onClick={handleAdd}
          disabled={priceUzs <= 0}
          className="w-8 h-8 flex items-center justify-center bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

// ===== CUSTOM SERVICE ROW =====

interface CustomServiceRowProps {
  masters: Array<{ id: number; fullName: string }>;
  onAdd: (name: string, uzs: number, masterId: number | null, qty: number) => void;
}

function CustomServiceRow({ masters, onAdd }: CustomServiceRowProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [masterId, setMasterId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);

  function handleAdd() {
    if (!name.trim()) { toast.error("Xizmat nomini kiriting"); return; }
    onAdd(name, Number(price) || 0, masterId, qty);
    setName("");
    setPrice("");
    setMasterId(null);
    setQty(1);
  }

  return (
    <tr className="bg-gray-50/50">
      <td className="px-4 py-2.5">
        <input
          type="text"
          placeholder="Boshqa xizmat..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-sm py-1 px-2 border border-gray-200 rounded-lg outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 bg-white"
        />
      </td>
      <td className="px-3 py-2.5">
        <input
          type="number"
          placeholder="Narx"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full text-sm py-1 px-2 border border-gray-200 rounded-lg outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 bg-white currency-uzs"
        />
      </td>
      <td className="px-3 py-2.5">
        <select
          value={masterId ?? ""}
          onChange={(e) => setMasterId(e.target.value ? Number(e.target.value) : null)}
          className="w-full text-sm py-1 px-2 border border-gray-200 rounded-lg bg-white text-gray-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
        >
          <option value="">Tanlanmagan</option>
          {masters.map((m) => (
            <option key={m.id} value={m.id}>{m.fullName}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5 text-center">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 1)}
          min={1}
          className="w-14 text-sm text-center py-1 border border-gray-200 rounded-lg outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 bg-white"
        />
      </td>
      <td className="px-3 py-2.5">
        <button
          onClick={handleAdd}
          className="w-8 h-8 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
