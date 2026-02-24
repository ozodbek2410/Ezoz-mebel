import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Phone, Package, ChevronLeft, ChevronRight, Check, ShoppingBag, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatUzs } from "@ezoz/shared";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useT } from "@/hooks/useT";

interface ProductDetailPageProps {
  productId: number;
  onBack: () => void;
  companyName: string;
  companyPhone?: string;
  onGoToCart: () => void;
}

export function ProductDetailPage({ productId, onBack, companyName, companyPhone, onGoToCart }: ProductDetailPageProps) {
  const t = useT();
  const [currentImage, setCurrentImage] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);

  const { cart, addToCart, updateQuantity } = useMarketplaceStore();
  const cartItem = cart.find((c) => c.productId === productId);

  const productQuery = useQuery({
    queryKey: ["marketplace", "product", productId],
    queryFn: () => trpc.product.marketplaceDetail.query({ id: productId }),
  });

  const product = productQuery.data;

  if (productQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-white h-14 lg:h-16 border-b border-gray-200" />
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="animate-pulse lg:grid lg:grid-cols-2 lg:gap-8">
            <div className="aspect-square bg-white rounded-xl mb-4 lg:mb-0" />
            <div className="space-y-4">
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="h-7 bg-gray-200 rounded w-3/4" />
              <div className="h-8 bg-gray-200 rounded w-1/3" />
              <div className="h-12 bg-gray-200 rounded-xl w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-white h-14 lg:h-16 border-b border-gray-200" />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Package className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 mb-3">{t("Mahsulot topilmadi")}</p>
            <button onClick={onBack} className="text-sm text-brand-600 font-medium">
              {t("Katalogga qaytish")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const images = product.images ?? [];
  const hasStock = product.stockItems.some((s) => Number(s.quantity) > 0);
  const firstImage = images.length > 0 ? images[0]!.filePath : null;

  function handleAddToCart() {
    addToCart({
      productId: product!.id,
      name: product!.name,
      image: firstImage,
      priceUzs: Number(product!.sellPriceUzs),
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  function prevImage() {
    setCurrentImage((c) => (c > 0 ? c - 1 : images.length - 1));
  }
  function nextImage() {
    setCurrentImage((c) => (c < images.length - 1 ? c + 1 : 0));
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 lg:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <span className="text-sm lg:text-base font-semibold text-gray-800 truncate max-w-[250px] lg:max-w-none">{product.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {companyPhone && (
              <a href={`tel:${companyPhone}`} className="text-xs text-brand-600 font-medium flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{companyPhone}</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ===== DESKTOP: 2-column layout ===== */}
      <main className="max-w-7xl mx-auto px-4 py-4 lg:py-8">
        <div className="lg:grid lg:grid-cols-[1fr_420px] xl:grid-cols-2 lg:gap-8">

          {/* LEFT — Image gallery */}
          <div>
            {/* Main image */}
            <div className="aspect-square bg-white rounded-2xl overflow-hidden relative group border border-gray-200 mb-3">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[currentImage]!.filePath}
                    alt={product.name}
                    className="w-full h-full object-contain p-4 rounded-2xl"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector(".img-fallback")) {
                        const fallback = document.createElement("div");
                        fallback.className = "img-fallback w-full h-full flex items-center justify-center";
                        fallback.innerHTML = '<svg class="w-16 h-16 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 shadow-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-700" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 shadow-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-700" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentImage(idx)}
                            className={`rounded-full transition-all ${
                              idx === currentImage ? "bg-brand-600 w-5 h-2" : "bg-gray-300 w-2 h-2"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-20 h-20 text-gray-200" />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 mb-4 lg:mb-0 overflow-x-auto scrollbar-hide">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImage(idx)}
                    className={`w-16 h-16 lg:w-20 lg:h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                      idx === currentImage ? "border-brand-600 shadow-md" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={img.filePath}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Product info + actions */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
            {/* Product info card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{product.category.name}</p>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900 leading-snug">{product.name}</h1>
              </div>

              {/* Price */}
              {product.showPrice ? (
                <p className="text-2xl lg:text-3xl font-bold text-gray-900">{formatUzs(Number(product.sellPriceUzs))}</p>
              ) : (
                <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                  <p className="text-brand-700 font-semibold text-sm">{t("Narxi kelishiladi")}</p>
                  {companyPhone && (
                    <a
                      href={`tel:${companyPhone}`}
                      className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      {companyPhone}
                    </a>
                  )}
                </div>
              )}

              {/* Stock */}
              <div className="flex items-center gap-1.5">
                {hasStock ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                    <Check className="w-4 h-4" />
                    {t("Omborda mavjud")}
                  </span>
                ) : (
                  <span className="text-sm text-red-500 font-medium">{t("Hozirda mavjud emas")}</span>
                )}
              </div>

              {/* Add to cart / quantity — desktop inline */}
              <div className="pt-2 space-y-3">
                {product.showPrice && cartItem ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => updateQuantity(productId, cartItem.quantity - 1)}
                        className="w-11 h-11 flex items-center justify-center hover:bg-gray-200 transition-colors"
                      >
                        <Minus className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="w-12 text-center text-sm font-bold">{cartItem.quantity}</span>
                      <button
                        onClick={() => updateQuantity(productId, cartItem.quantity + 1)}
                        className="w-11 h-11 flex items-center justify-center hover:bg-gray-200 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    <button
                      onClick={onGoToCart}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {t("Savatchaga o'tish")}
                    </button>
                  </div>
                ) : product.showPrice ? (
                  <button
                    onClick={handleAddToCart}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all ${
                      addedToCart
                        ? "bg-emerald-500 text-white"
                        : "bg-brand-600 text-white hover:bg-brand-700"
                    }`}
                  >
                    {addedToCart ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t("Qo'shildi!")}
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        {t("Savatga qo'shish")} — {formatUzs(Number(product.sellPriceUzs))}
                      </>
                    )}
                  </button>
                ) : companyPhone ? (
                  <a
                    href={`tel:${companyPhone}`}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {t("Qo'ng'iroq qilish")}
                  </a>
                ) : null}

                {/* Buy now — direct order */}
                {product.showPrice && (
                  <button
                    onClick={() => {
                      if (!cartItem) {
                        addToCart({
                          productId: product.id,
                          name: product.name,
                          image: firstImage,
                          priceUzs: Number(product.sellPriceUzs),
                        });
                      }
                      onGoToCart();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border-2 border-brand-600 text-brand-600 hover:bg-brand-50 transition-colors"
                  >
                    {t("Buyurtma berish")}
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">{t("Tavsif")}</h3>
                <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {/* Specs */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t("Xususiyatlari")}</h3>
              <div className="divide-y divide-gray-100">
                <div className="flex justify-between py-2.5 text-sm">
                  <span className="text-gray-400">{t("Kategoriya")}</span>
                  <span className="font-medium text-gray-700">{product.category.name}</span>
                </div>
                <div className="flex justify-between py-2.5 text-sm">
                  <span className="text-gray-400">{t("O'lchov birligi")}</span>
                  <span className="font-medium text-gray-700">{product.unit}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom CTA — mobile only */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-50 safe-area-bottom lg:hidden">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {product.showPrice && cartItem ? (
            <>
              <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => updateQuantity(productId, cartItem.quantity - 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Minus className="w-4 h-4 text-gray-600" />
                </button>
                <span className="w-10 text-center text-sm font-semibold">{cartItem.quantity}</span>
                <button
                  onClick={() => updateQuantity(productId, cartItem.quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <button
                onClick={onGoToCart}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                {t("Savatchaga o'tish")}
              </button>
            </>
          ) : product.showPrice ? (
            <button
              onClick={handleAddToCart}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                addedToCart
                  ? "bg-emerald-500 text-white"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {addedToCart ? (
                <>
                  <Check className="w-4 h-4" />
                  {t("Qo'shildi")}
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  {t("Savatga qo'shish")} — {formatUzs(Number(product.sellPriceUzs))}
                </>
              )}
            </button>
          ) : companyPhone ? (
            <a
              href={`tel:${companyPhone}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm"
            >
              <Phone className="w-4 h-4" />
              {t("Qo'ng'iroq qilish")}
            </a>
          ) : null}
        </div>
      </div>

      {/* Bottom spacing for mobile */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}
