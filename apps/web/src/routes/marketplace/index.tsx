import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Phone, MapPin, Clock, ChevronRight, ChevronLeft, Package, X,
  Home, ShoppingBag, ClipboardList, User,
  Truck, Shield, CreditCard, Headphones,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatUzs } from "@ezoz/shared";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useT } from "@/hooks/useT";
import { ProductDetailPage } from "./product";
import { CartPage } from "./cart";
import { OrdersPage } from "./orders";
import { ProfilePage } from "./profile";

type Tab = "home" | "cart" | "orders" | "profile";

export function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const t = useT();
  const cartCount = useMarketplaceStore((s) => s.getCartCount());

  const productsQuery = useQuery({
    queryKey: ["marketplace", "products", search, selectedCategory, page],
    queryFn: () =>
      trpc.product.marketplace.query({
        search: search || undefined,
        categoryId: selectedCategory,
        page,
        limit: 24,
      }),
    enabled: activeTab === "home",
  });

  const categoriesQuery = useQuery({
    queryKey: ["category", "tree"],
    queryFn: () => trpc.category.getTree.query(),
  });

  const companyInfo = useQuery({
    queryKey: ["settings", "companyInfo"],
    queryFn: () => trpc.settings.getCompanyInfo.query(),
  });

  const products = productsQuery.data?.products ?? [];
  const total = productsQuery.data?.total ?? 0;
  const company = companyInfo.data ?? {};
  const categories = categoriesQuery.data ?? [];
  const totalPages = Math.ceil(total / 24);
  const companyName = String(company["name"] || "EZOZ MEBEL");
  const companyPhone = company["phone"] ? String(company["phone"]) : undefined;

  // Product detail view
  if (selectedProductId !== null) {
    return (
      <ProductDetailPage
        productId={selectedProductId}
        onBack={() => setSelectedProductId(null)}
        companyName={companyName}
        companyPhone={companyPhone}
        onGoToCart={() => { setSelectedProductId(null); setActiveTab("cart"); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <MetaTags
        title={`${companyName} - Mebel katalogi`}
        description={`${companyName} mebel do'koni. ${total} dan ortiq mahsulot.`}
      />

      {/* ===== HEADER ===== */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          {/* Top row: Logo + Desktop Nav + Search + Actions */}
          <div className="flex items-center gap-4 h-14 lg:h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                EZ
              </div>
              <span className="text-lg font-bold text-gray-900 tracking-tight hidden sm:block">{companyName}</span>
            </div>

            {/* Desktop navigation */}
            <nav className="hidden lg:flex items-center gap-1 ml-4">
              {([
                { id: "home" as Tab, label: t("Katalog"), icon: Home },
                { id: "orders" as Tab, label: t("Buyurtmalar"), icon: ClipboardList },
                { id: "profile" as Tab, label: t("Biz haqimizda"), icon: User },
              ]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? "text-brand-600 bg-brand-50"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Search — desktop inline, mobile full width below */}
            <div className="flex-1 hidden lg:block max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t("Mahsulot qidirish...")}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); setActiveTab("home"); }}
                  className="w-full pl-9 pr-9 py-2 bg-gray-100 rounded-lg text-sm text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/20 border border-transparent focus:border-brand-300 transition-all"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(""); setPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 lg:hidden" />

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {companyPhone && (
                <a href={`tel:${companyPhone}`} className="hidden sm:flex items-center gap-1.5 text-xs text-gray-600 hover:text-brand-600 font-medium transition-colors">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{companyPhone}</span>
                </a>
              )}
              {/* Cart button — desktop */}
              <button
                onClick={() => setActiveTab("cart")}
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium relative transition-colors text-gray-600 hover:text-brand-600 hover:bg-gray-50"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{t("Savatcha")}</span>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 left-5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="pb-3 lg:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t("Mahsulot qidirish...")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); setActiveTab("home"); }}
                className="w-full pl-9 pr-9 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500/20 border border-transparent focus:border-brand-300 transition-all"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===== TAB CONTENT ===== */}
      {activeTab === "home" && (
        <>
          {/* CATEGORIES */}
          <nav className="bg-white border-b border-gray-200 sticky top-[105px] lg:top-[64px] z-40">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center gap-2 py-2.5 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => { setSelectedCategory(undefined); setPage(1); }}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    !selectedCategory
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t("Barchasi")}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedCategory === cat.id
                        ? "bg-brand-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cat.name}
                    {cat._count.products > 0 && (
                      <span className="ml-1 opacity-60">{cat._count.products}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* MAIN CONTENT */}
          <main className="max-w-7xl mx-auto px-4 py-4 lg:py-6">
            {/* Banner carousel — Yandex Market style */}
            {!search && !selectedCategory && (
              <BannerCarousel
                onProductClick={(productId) => setSelectedProductId(productId)}
              />
            )}

            {/* Breadcrumb */}
            <div id="product-grid" className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="flex items-center gap-1.5 text-xs lg:text-sm text-gray-400">
                <span>{t("Katalog")}</span>
                {selectedCategory && categories.find((c) => c.id === selectedCategory) && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-gray-700 font-medium">
                      {categories.find((c) => c.id === selectedCategory)?.name}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs lg:text-sm text-gray-400">{`${total} ${t("ta mahsulot")}`}</p>
            </div>

            {/* Product Grid */}
            {productsQuery.isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-white rounded-xl overflow-hidden">
                    <div className="aspect-square bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-3.5 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{t("Mahsulot topilmadi")}</p>
                {search && (
                  <button
                    onClick={() => { setSearch(""); setPage(1); }}
                    className="mt-2 text-xs text-brand-600 font-medium"
                  >
                    {t("Qidiruvni tozalash")}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className="group text-left bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-brand-200 hover:shadow-lg transition-all duration-200"
                  >
                    <div className="aspect-square bg-gray-50 overflow-hidden">
                      {product.images.length > 0 ? (
                        <img
                          src={product.images[0]!.filePath}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-10 h-10 text-gray-200" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 lg:p-4 space-y-1">
                      <p className="text-[10px] lg:text-xs text-gray-400 uppercase tracking-wider">{product.category.name}</p>
                      <h3 className="text-sm lg:text-base font-medium text-gray-800 leading-snug line-clamp-2">
                        {product.name}
                      </h3>
                      {product.showPrice ? (
                        <p className="text-sm lg:text-base font-bold text-gray-900">{formatUzs(Number(product.sellPriceUzs))}</p>
                      ) : (
                        <p className="text-xs lg:text-sm text-brand-600 font-semibold">{t("Narxi kelishiladi")}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
                >
                  {t("Oldingi")}
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || (pageNum >= page - 1 && pageNum <= page + 1)) {
                    return (
                      <button
                        key={i}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          page === pageNum
                            ? "bg-brand-600 text-white"
                            : "text-gray-500 bg-white border border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  if (pageNum === page - 2 || pageNum === page + 2) {
                    return <span key={i} className="text-gray-300 px-0.5 text-xs">...</span>;
                  }
                  return null;
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
                >
                  {t("Keyingi")}
                </button>
              </div>
            )}

            {/* Features */}
            {!search && !selectedCategory && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mt-8">
                {[
                  { icon: Truck, title: t("Bepul yetkazish"), desc: t("Shahar bo'ylab") },
                  { icon: Shield, title: t("Kafolat"), desc: t("1 yillik") },
                  { icon: CreditCard, title: t("Nasiya"), desc: t("12 oygacha") },
                  { icon: Headphones, title: t("Qo'llab-quvvatlash"), desc: t("Har doim aloqada") },
                ].map((f, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 lg:p-5 text-center border border-gray-100 hover:shadow-sm transition-shadow">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <f.icon className="w-5 h-5 lg:w-6 lg:h-6 text-brand-600" />
                    </div>
                    <h3 className="text-xs lg:text-sm font-semibold text-gray-800">{f.title}</h3>
                    <p className="text-[10px] lg:text-xs text-gray-400 mt-0.5">{f.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Footer info */}
            <div className="mt-8 lg:mt-12 pt-6 border-t border-gray-200 text-center space-y-2 pb-6">
              <div className="flex items-center justify-center gap-2">
                <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-[9px]">EZ</div>
                <span className="text-sm font-bold text-gray-800">{companyName}</span>
              </div>
              <p className="text-xs text-gray-400">{t("Sifatli mebel va professional xizmat")}</p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                {company["address"] && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {company["address"]}
                  </span>
                )}
                {company["workHours"] && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {company["workHours"]}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-300 pt-2">
                {companyName} &copy; {new Date().getFullYear()}
              </p>
            </div>
          </main>
        </>
      )}

      {activeTab === "cart" && (
        <CartPage
          companyName={companyName}
          companyPhone={companyPhone}
          onGoHome={() => setActiveTab("home")}
          onOrderSuccess={() => setActiveTab("orders")}
        />
      )}

      {activeTab === "orders" && (
        <OrdersPage companyName={companyName} />
      )}

      {activeTab === "profile" && (
        <ProfilePage
          companyName={companyName}
          companyPhone={companyPhone}
          companyAddress={company["address"] ? String(company["address"]) : undefined}
          companyWorkHours={company["workHours"] ? String(company["workHours"]) : undefined}
        />
      )}

      {/* ===== BOTTOM NAV — mobile only ===== */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom lg:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-around h-16">
          {([
            { id: "home" as Tab, icon: Home, label: t("Bosh sahifa") },
            { id: "cart" as Tab, icon: ShoppingBag, label: t("Savatcha"), badge: cartCount },
            { id: "orders" as Tab, icon: ClipboardList, label: t("Buyurtmalar") },
            { id: "profile" as Tab, icon: User, label: t("Profil") },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 relative transition-colors ${
                activeTab === tab.id
                  ? "text-brand-600"
                  : "text-gray-400"
              }`}
            >
              <div className="relative">
                <tab.icon className="w-5 h-5" />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="h-16 lg:hidden" />
    </div>
  );
}

function MetaTags({ title, description }: { title: string; description: string }) {
  if (typeof document !== "undefined") {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }
  return null;
}

// ========== BANNER CAROUSEL — Yandex Market style ==========
const BANNER_IMAGES = [
  { src: "/reklama.webp", name: "reklama.webp" },
  { src: "/reklama1.webp", name: "reklama1.webp" },
  { src: "/reklama2.webp", name: "reklama2.webp" },
  { src: "/reklama3.webp", name: "reklama3.webp" },
];

const SLIDE_INTERVAL = 5000;
const TRANSITION_DURATION = 500;

interface BannerCarouselProps {
  onProductClick: (productId: number) => void;
}

function BannerCarousel({ onProductClick }: BannerCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartRef = useRef(0);

  const bannerLinksQuery = useQuery({
    queryKey: ["marketplace", "bannerLinks"],
    queryFn: () => trpc.marketplaceOrder.getBannerLinks.query(),
    staleTime: 60000,
  });

  const bannerLinks = bannerLinksQuery.data ?? {};
  const totalMain = BANNER_IMAGES.length;

  const sideIdx1 = (current + 1) % totalMain;
  const sideIdx2 = (current + 2) % totalMain;

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % totalMain);
  }, [totalMain]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + totalMain) % totalMain);
  }, [totalMain]);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
  }, []);

  // Auto-play
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(next, SLIDE_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [next, isPaused]);

  function handleBannerClick(bannerName: string) {
    const productId = bannerLinks[bannerName];
    if (productId) {
      onProductClick(productId);
    }
  }

  // Touch swipe for mobile
  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = e.touches[0]!.clientX;
    setIsPaused(true);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = touchStartRef.current - e.changedTouches[0]!.clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
    setIsPaused(false);
  }

  const currentBanner = BANNER_IMAGES[current]!;
  const hasLink = (name: string) => !!bannerLinks[name];

  return (
    <div className="mb-5 lg:mb-6">
      {/* ===== DESKTOP: Grid layout — 1 large + 2 small ===== */}
      <div className="hidden lg:grid grid-cols-[1fr_320px] gap-3 h-[280px] xl:h-[320px]">
        {/* Main large banner with carousel */}
        <div
          className={`relative rounded-2xl overflow-hidden bg-gray-200 group/main ${hasLink(currentBanner.name) ? "cursor-pointer" : ""}`}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onClick={() => handleBannerClick(currentBanner.name)}
        >
          {BANNER_IMAGES.map((banner, i) => (
            <img
              key={i}
              src={banner.src}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: current === i ? 1 : 0,
                transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
                zIndex: current === i ? 1 : 0,
              }}
              loading={i === 0 ? "eager" : "lazy"}
              draggable={false}
            />
          ))}

          {/* Navigation arrows */}
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/80 backdrop-blur-sm hover:bg-white rounded-full flex items-center justify-center opacity-0 group-hover/main:opacity-100 transition-all shadow-md"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/80 backdrop-blur-sm hover:bg-white rounded-full flex items-center justify-center opacity-0 group-hover/main:opacity-100 transition-all shadow-md"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
            {BANNER_IMAGES.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); goTo(i); }}
                className={`rounded-full transition-all duration-300 ${
                  current === i
                    ? "w-6 h-2 bg-white shadow-sm"
                    : "w-2 h-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Side banners — 2 stacked */}
        <div className="flex flex-col gap-3">
          <div
            className={`relative flex-1 rounded-2xl overflow-hidden bg-gray-200 ${hasLink(BANNER_IMAGES[sideIdx1]!.name) ? "cursor-pointer" : ""} hover:opacity-90 transition-opacity`}
            onClick={() => { goTo(sideIdx1); handleBannerClick(BANNER_IMAGES[sideIdx1]!.name); }}
          >
            <img
              src={BANNER_IMAGES[sideIdx1]!.src}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
          </div>
          <div
            className={`relative flex-1 rounded-2xl overflow-hidden bg-gray-200 ${hasLink(BANNER_IMAGES[sideIdx2]!.name) ? "cursor-pointer" : ""} hover:opacity-90 transition-opacity`}
            onClick={() => { goTo(sideIdx2); handleBannerClick(BANNER_IMAGES[sideIdx2]!.name); }}
          >
            <img
              src={BANNER_IMAGES[sideIdx2]!.src}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* ===== MOBILE: Full-width carousel ===== */}
      <div
        className="lg:hidden relative rounded-2xl overflow-hidden bg-gray-200 aspect-[16/7]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => handleBannerClick(currentBanner.name)}
      >
        {BANNER_IMAGES.map((banner, i) => (
          <img
            key={i}
            src={banner.src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: current === i ? 1 : 0,
              transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
              zIndex: current === i ? 1 : 0,
            }}
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
          />
        ))}

        {/* Dots */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
          {BANNER_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); goTo(i); }}
              className={`rounded-full transition-all duration-300 ${
                current === i
                  ? "w-5 h-1.5 bg-white shadow-sm"
                  : "w-1.5 h-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
