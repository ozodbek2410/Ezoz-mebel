import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Eye, EyeOff, DollarSign, ToggleLeft, ToggleRight,
  Clock, Check, XCircle, ChevronDown, Image, Trash2, Upload, ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatUzs } from "@ezoz/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import {
  SearchInput, Table, TableHead, TableBody, TableRow, TableEmpty, TableLoading,
  Badge, Button,
} from "@/components/ui";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth.store";

type TabId = "products" | "banners" | "orders";

export function MarketplaceSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("products");

  const ordersQuery = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: () => trpc.marketplaceOrder.list.query(),
    enabled: activeTab === "orders",
  });

  const pendingCount = ordersQuery.data?.filter((o) => o.status === "PENDING").length ?? 0;

  return (
    <>
      <PageHeader
        title="Marketplace"
        subtitle="Mahsulotlar, reklama va buyurtmalarni boshqarish"
        actions={
          <a
            href="/marketplace"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-600 text-sm font-medium rounded-lg hover:bg-brand-100 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Marketplace'ni ko'rish
          </a>
        }
      />

      <div className="page-body">
        <Tabs
          tabs={[
            { id: "products", label: "Mahsulotlar" },
            { id: "banners", label: "Reklama" },
            { id: "orders", label: "Buyurtmalar", count: pendingCount > 0 ? pendingCount : undefined },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />

        <div className="mt-4">
          {activeTab === "products" && <ProductsTab />}
          {activeTab === "banners" && <BannersTab />}
          {activeTab === "orders" && <OrdersTab />}
        </div>
      </div>
    </>
  );
}

// ==================== PRODUCTS TAB ====================
function ProductsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: ["product", "list-marketplace"],
    queryFn: () => trpc.product.list.query({}),
  });

  const toggleVisibility = useMutation({
    mutationFn: (data: { id: number; isMarketplaceVisible: boolean }) =>
      trpc.product.update.mutate({
        id: data.id,
        isMarketplaceVisible: data.isMarketplaceVisible,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      toast.success("Yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleShowPrice = useMutation({
    mutationFn: (data: { id: number; showPrice: boolean }) =>
      trpc.product.update.mutate({
        id: data.id,
        showPrice: data.showPrice,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      toast.success("Yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const products = productsQuery.data ?? [];
  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const toggleAll = useMutation({
    mutationFn: async (visible: boolean) => {
      const toUpdate = products.filter((p) => p.isMarketplaceVisible !== visible);
      for (const p of toUpdate) {
        await trpc.product.update.mutate({ id: p.id, isMarketplaceVisible: visible });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product"] });
      toast.success("Barcha mahsulotlar yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const visibleCount = products.filter((p) => p.isMarketplaceVisible).length;
  const allVisible = products.length > 0 && visibleCount === products.length;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <SearchInput
            placeholder="Mahsulot qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
        <Badge variant="neutral">{visibleCount} / {products.length} ko'rinadi</Badge>
        <Button
          onClick={() => toggleAll.mutate(!allVisible)}
          disabled={toggleAll.isPending || products.length === 0}
          variant={allVisible ? "secondary" : "primary"}
          className="shrink-0"
        >
          {allVisible ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {allVisible ? "Barchasini yashirish" : "Barchasini ko'rsatish"}
        </Button>
      </div>

      <Table>
        <TableHead>
          <tr>
            <th>Mahsulot</th>
            <th>Guruh</th>
            <th>Narx</th>
            <th>Marketplace da ko'rinsin</th>
            <th>Narx ko'rsatilsin</th>
          </tr>
        </TableHead>
        <TableBody>
          {productsQuery.isLoading ? (
            <TableLoading colSpan={5} />
          ) : filtered.length === 0 ? (
            <TableEmpty colSpan={5} message="Mahsulot topilmadi" />
          ) : (
            filtered.map((product) => (
              <TableRow key={product.id}>
                <td className="font-medium">{product.name}</td>
                <td><Badge variant="neutral">{product.category.name}</Badge></td>
                <td className="currency-uzs text-sm">
                  {new Intl.NumberFormat("uz").format(Number(product.sellPriceUzs))} so'm
                </td>
                <td>
                  <button
                    onClick={() => toggleVisibility.mutate({ id: product.id, isMarketplaceVisible: !product.isMarketplaceVisible })}
                    className={`p-2 rounded-lg transition-colors ${
                      product.isMarketplaceVisible
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {product.isMarketplaceVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </td>
                <td>
                  <button
                    onClick={() => toggleShowPrice.mutate({ id: product.id, showPrice: !product.showPrice })}
                    className={`p-2 rounded-lg transition-colors ${
                      product.showPrice
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                  </button>
                </td>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}

// ==================== BANNERS TAB ====================
const BANNER_FILES = ["reklama.webp", "reklama1.webp", "reklama2.webp", "reklama3.webp"];

function BannersTab() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);
  const [bannerKeys, setBannerKeys] = useState(() => Date.now());
  const [selectingProduct, setSelectingProduct] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const bannerLinksQuery = useQuery({
    queryKey: ["banner-links"],
    queryFn: () => trpc.marketplaceOrder.getBannerLinks.query(),
  });

  const productsQuery = useQuery({
    queryKey: ["product", "list-for-banners"],
    queryFn: () => trpc.product.list.query({}),
    enabled: selectingProduct !== null,
  });

  const setBannerLink = useMutation({
    mutationFn: (data: { bannerName: string; productId: number | null }) =>
      trpc.marketplaceOrder.setBannerLink.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banner-links"] });
      setSelectingProduct(null);
      setProductSearch("");
      toast.success("Banner mahsuloti yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const bannerLinks = bannerLinksQuery.data ?? {};
  const allProducts = productsQuery.data ?? [];
  const filteredProducts = productSearch
    ? allProducts.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : allProducts;

  async function handleUpload(file: File, targetName: string) {
    setUploading(targetName);
    try {
      const token = useAuthStore.getState().token;
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/upload/marketplace-banner?name=${encodeURIComponent(targetName)}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload xatosi");
      }

      toast.success(`${targetName} yangilandi`);
      setBannerKeys(Date.now());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload xatosi");
    } finally {
      setUploading(null);
    }
  }

  function getLinkedProductName(bannerName: string): string | undefined {
    const pid = bannerLinks[bannerName];
    if (!pid) return undefined;
    // Try to find from loaded products list
    const found = allProducts.find((p) => p.id === pid);
    return found?.name ?? `Mahsulot #${pid}`;
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Reklama bannerlarini boshqaring. Har bir bannerga mahsulot biriktirsangiz, foydalanuvchi bosganda o'sha mahsulotga o'tadi.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {BANNER_FILES.map((name, i) => {
          const linkedName = getLinkedProductName(name);
          const linkedId = bannerLinks[name];

          return (
            <div key={name} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Banner image */}
              <div className="aspect-[16/7] bg-gray-100 relative group">
                <img
                  key={bannerKeys}
                  src={`/${name}?t=${bannerKeys}`}
                  alt={`Banner ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/webp,image/png,image/jpeg";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleUpload(file, name);
                      };
                      input.click();
                    }}
                    disabled={uploading === name}
                    className="opacity-0 group-hover:opacity-100 transition-opacity px-4 py-2 bg-white/90 text-gray-800 text-sm font-medium rounded-lg hover:bg-white flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading === name ? "Yuklanmoqda..." : "Rasm almashtirish"}
                  </button>
                </div>
              </div>

              {/* Info + product link */}
              <div className="px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-600 font-medium">Banner {i + 1}</span>
                  </div>
                </div>

                {/* Linked product */}
                <div className="flex items-center gap-2">
                  {linkedId ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-emerald-600 font-medium truncate flex-1">
                        {linkedName}
                      </span>
                      <button
                        onClick={() => setBannerLink.mutate({ bannerName: name, productId: null })}
                        className="text-xs text-red-400 hover:text-red-600 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 flex-1">Mahsulot biriktirilmagan</span>
                  )}
                  <button
                    onClick={() => setSelectingProduct(name)}
                    className="text-xs text-brand-600 font-medium hover:text-brand-700 shrink-0"
                  >
                    {linkedId ? "O'zgartirish" : "Mahsulot tanlash"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
        <p className="text-xs text-amber-700">
          Tavsiya: Banner rasmlari 1200x500px o'lchamda, WebP formatida bo'lsin.
        </p>
      </div>

      {/* Product selection modal */}
      {selectingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setSelectingProduct(null); setProductSearch(""); }}>
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-gray-900 text-sm">Mahsulot tanlash — Banner {BANNER_FILES.indexOf(selectingProduct) + 1}</h3>
              <button onClick={() => { setSelectingProduct(null); setProductSearch(""); }} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-2 border-b shrink-0">
              <input
                type="text"
                placeholder="Mahsulot qidirish..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {productsQuery.isLoading ? (
                <div className="p-4 text-center text-sm text-gray-400">Yuklanmoqda...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">Topilmadi</div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setBannerLink.mutate({ bannerName: selectingProduct, productId: product.id })}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      {product.images?.[0] ? (
                        <img src={product.images[0].filePath} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.category.name}</p>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatUzs(Number(product.sellPriceUzs))}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== ORDERS TAB ====================
function OrdersTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: () => trpc.marketplaceOrder.list.query(),
  });

  const updateStatus = useMutation({
    mutationFn: (data: { id: number; status: "CONFIRMED" | "CANCELLED" }) =>
      trpc.marketplaceOrder.updateStatus.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      toast.success("Status yangilandi");
    },
    onError: (err) => toast.error(err.message),
  });

  const orders = ordersQuery.data ?? [];
  const filtered = statusFilter === "all"
    ? orders
    : orders.filter((o) => o.status === statusFilter);

  const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    PENDING: { label: "Kutilmoqda", color: "bg-amber-100 text-amber-700", icon: Clock },
    CONFIRMED: { label: "Tasdiqlangan", color: "bg-emerald-100 text-emerald-700", icon: Check },
    CANCELLED: { label: "Bekor qilingan", color: "bg-red-100 text-red-600", icon: XCircle },
  };

  const counts = {
    all: orders.length,
    PENDING: orders.filter((o) => o.status === "PENDING").length,
    CONFIRMED: orders.filter((o) => o.status === "CONFIRMED").length,
    CANCELLED: orders.filter((o) => o.status === "CANCELLED").length,
  };

  return (
    <>
      {/* Status filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {([
          { id: "all", label: "Barchasi" },
          { id: "PENDING", label: "Kutilmoqda" },
          { id: "CONFIRMED", label: "Tasdiqlangan" },
          { id: "CANCELLED", label: "Bekor qilingan" },
        ] as const).map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === f.id
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-60">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {ordersQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-lg p-4">
              <div className="h-4 bg-gray-100 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          Buyurtmalar topilmadi
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const config = statusConfig[order.status]!;
            const StatusIcon = config.icon;
            const isExpanded = expandedOrder === order.id;

            return (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* Order header */}
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-gray-900">#{order.id}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${config.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{order.customerName}</span>
                      <span>{order.customerPhone}</span>
                      <span>{new Date(order.createdAt).toLocaleString("uz")}</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900 shrink-0">
                    {formatUzs(Number(order.totalUzs))}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {/* Items */}
                    <div className="mt-3 space-y-1.5">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {item.productName} <span className="text-gray-400">x{item.quantity}</span>
                          </span>
                          <span className="font-medium text-gray-800">{formatUzs(Number(item.totalUzs))}</span>
                        </div>
                      ))}
                    </div>

                    {/* Info */}
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-500">
                      {order.address && <p>Manzil: <span className="text-gray-700">{order.address}</span></p>}
                      {order.notes && <p>Izoh: <span className="text-gray-700">{order.notes}</span></p>}
                    </div>

                    {/* Actions */}
                    {order.status === "PENDING" && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: "CONFIRMED" })}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Tasdiqlash
                        </button>
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: "CANCELLED" })}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Bekor qilish
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
