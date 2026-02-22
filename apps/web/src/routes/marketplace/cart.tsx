import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShoppingBag, Trash2, Plus, Minus, Package, Check, ArrowLeft } from "lucide-react";
import { formatUzs } from "@ezoz/shared";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { trpc } from "@/lib/trpc";

interface CartPageProps {
  companyName: string;
  companyPhone?: string;
  onGoHome: () => void;
  onOrderSuccess: () => void;
}

export function CartPage({ companyName, companyPhone, onGoHome, onOrderSuccess }: CartPageProps) {
  const { cart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useMarketplaceStore();
  const [showCheckout, setShowCheckout] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  const createOrder = useMutation({
    mutationFn: () =>
      trpc.marketplaceOrder.create.mutate({
        customerName: name,
        customerPhone: phone,
        address: address || undefined,
        notes: notes || undefined,
        items: cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
        })),
      }),
    onSuccess: (data) => {
      setOrderId(data.id);
      setOrderSuccess(true);
      clearCart();
    },
  });

  const total = getCartTotal();

  // Order success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 h-14 lg:h-16 flex items-center">
            <span className="text-sm lg:text-base font-semibold text-gray-800">{companyName}</span>
          </div>
        </header>
        <div className="flex items-center justify-center py-24 px-4">
          <div className="text-center max-w-md bg-white rounded-2xl border border-gray-200 p-8 lg:p-12">
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 lg:w-10 lg:h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">Buyurtma qabul qilindi!</h2>
            <p className="text-sm lg:text-base text-gray-500 mb-1">Buyurtma raqami: <span className="font-semibold text-gray-800">#{orderId}</span></p>
            <p className="text-xs lg:text-sm text-gray-400 mb-6">
              Tez orada operatorimiz siz bilan bog'lanadi
            </p>
            <div className="space-y-2">
              <button
                onClick={onOrderSuccess}
                className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
              >
                Buyurtmalarni ko'rish
              </button>
              <button
                onClick={onGoHome}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Xarid davom ettirish
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Checkout form
  if (showCheckout) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-14 lg:h-16 flex items-center gap-2">
            <button onClick={() => setShowCheckout(false)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <span className="text-sm lg:text-base font-semibold text-gray-800">Buyurtma berish</span>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-4 lg:py-8">
          <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
            {/* LEFT — form */}
            <div className="space-y-4">
              {/* Customer info form */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">Ma'lumotlaringiz</h3>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Ism *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ismingiz"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Telefon raqam *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Manzil</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Yetkazib berish manzili"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Izoh</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Qo'shimcha izoh..."
                    rows={3}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none transition-all"
                  />
                </div>
              </div>

              {createOrder.error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                  {createOrder.error.message}
                </div>
              )}
            </div>

            {/* RIGHT — order summary + submit */}
            <div className="mt-4 lg:mt-0">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 lg:sticky lg:top-24">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Buyurtma</h3>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex justify-between text-sm">
                      <span className="text-gray-600 line-clamp-1 flex-1 mr-3">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                      <span className="font-medium text-gray-800 shrink-0">{formatUzs(item.priceUzs * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                  <span className="text-sm font-semibold text-gray-800">Jami:</span>
                  <span className="text-lg font-bold text-gray-900">{formatUzs(total)}</span>
                </div>

                {/* Submit button — inline in order summary */}
                <button
                  onClick={() => createOrder.mutate()}
                  disabled={!name.trim() || !phone.trim() || createOrder.isPending}
                  className="w-full mt-5 py-3.5 bg-brand-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors"
                >
                  {createOrder.isPending ? "Yuborilmoqda..." : `Buyurtma berish — ${formatUzs(total)}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA — mobile only */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-50 safe-area-bottom lg:hidden">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => createOrder.mutate()}
              disabled={!name.trim() || !phone.trim() || createOrder.isPending}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors"
            >
              {createOrder.isPending ? "Yuborilmoqda..." : `Buyurtma berish — ${formatUzs(total)}`}
            </button>
          </div>
        </div>
        <div className="h-20 lg:hidden" />
      </div>
    );
  }

  // Cart list
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 lg:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-600" />
            <span className="text-sm lg:text-base font-semibold text-gray-800">Savatcha</span>
            {cart.length > 0 && (
              <span className="text-xs text-gray-400">({cart.length} ta)</span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-500 font-medium flex items-center gap-1 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Tozalash
            </button>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 lg:py-8">
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">Savatcha bo'sh</p>
            <p className="text-xs text-gray-300 mb-4">Mahsulotlarni savatga qo'shing</p>
            <button
              onClick={onGoHome}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Xarid qilish
            </button>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">
            {/* LEFT — Cart items */}
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.productId} className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-4">
                  {/* Image */}
                  <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-200" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm lg:text-base font-medium text-gray-800 line-clamp-2 leading-snug">{item.name}</h3>
                    <p className="text-sm lg:text-base font-bold text-gray-900 mt-1">{formatUzs(item.priceUzs * item.quantity)}</p>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-gray-200 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <span className="w-9 text-center text-xs font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-gray-200 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT — Summary + checkout button (desktop) */}
            <div className="hidden lg:block mt-0">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Buyurtma xulosasi</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mahsulotlar ({cart.length} ta)</span>
                    <span className="font-medium text-gray-700">{formatUzs(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Yetkazish</span>
                    <span className="font-medium text-emerald-600">Bepul</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                  <span className="text-base font-semibold text-gray-800">Jami:</span>
                  <span className="text-xl font-bold text-gray-900">{formatUzs(total)}</span>
                </div>
                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full mt-5 py-3.5 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors"
                >
                  Buyurtma berish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom checkout — mobile only */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-40 lg:hidden">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{cart.length} ta mahsulot</span>
              <span className="text-sm font-bold text-gray-900">{formatUzs(total)}</span>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors"
            >
              Buyurtma berish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
