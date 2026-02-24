import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock, Check, XCircle, ChevronRight, Package } from "lucide-react";
import { formatUzs } from "@ezoz/shared";
import { trpc } from "@/lib/trpc";
import { useT } from "@/hooks/useT";

interface OrdersPageProps {
  companyName: string;
}

export function OrdersPage({ companyName }: OrdersPageProps) {
  const t = useT();
  const [checkOrderId, setCheckOrderId] = useState("");
  const [searchId, setSearchId] = useState<number | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const orderQuery = useQuery({
    queryKey: ["marketplace", "order", searchId],
    queryFn: () => trpc.marketplaceOrder.status.query({ id: searchId! }),
    enabled: searchId !== null,
  });

  const order = orderQuery.data;

  function handleSearch() {
    const id = parseInt(checkOrderId);
    if (!isNaN(id) && id > 0) {
      setSearchId(id);
    }
  }

  const statusConfig = {
    PENDING: { label: t("Kutilmoqda"), color: "text-amber-600 bg-amber-50", icon: Clock },
    CONFIRMED: { label: t("Tasdiqlangan"), color: "text-emerald-600 bg-emerald-50", icon: Check },
    CANCELLED: { label: t("Bekor qilingan"), color: "text-red-500 bg-red-50", icon: XCircle },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-brand-600" />
          <span className="text-sm font-semibold text-gray-800">{t("Buyurtmalar")}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-24">
        {/* Search order by ID */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t("Buyurtma tekshirish")}</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={checkOrderId}
              onChange={(e) => setCheckOrderId(e.target.value)}
              placeholder={t("Buyurtma raqami kiriting")}
              className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={!checkOrderId.trim()}
              className="px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 shrink-0"
            >
              {t("Tekshirish")}
            </button>
          </div>
        </div>

        {/* Order result */}
        {orderQuery.isLoading && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        )}

        {orderQuery.error && (
          <div className="bg-white rounded-xl border border-red-100 p-4 text-center">
            <XCircle className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{t("Buyurtma topilmadi")}</p>
          </div>
        )}

        {order && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Order header */}
            <div className="p-4 border-b border-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">{t("Buyurtma #")}{order.id}</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusConfig[order.status].color}`}>
                  {statusConfig[order.status].label}
                </span>
              </div>
              <div className="text-xs text-gray-400 space-y-0.5">
                <p>{t("Mijoz:")} <span className="text-gray-600">{order.customerName}</span></p>
                <p>{t("Telefon:")} <span className="text-gray-600">{order.customerPhone}</span></p>
                {order.address && <p>{t("Manzil:")} <span className="text-gray-600">{order.address}</span></p>}
                <p>{t("Sana:")} <span className="text-gray-600">{new Date(order.createdAt).toLocaleString("uz")}</span></p>
              </div>
            </div>

            {/* Items */}
            <div className="p-4 space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.productName} x{item.quantity}</span>
                  <span className="font-medium text-gray-800">{formatUzs(Number(item.totalUzs))}</span>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between">
                <span className="text-sm font-semibold text-gray-800">{t("Jami:")}</span>
                <span className="text-sm font-bold text-gray-900">{formatUzs(Number(order.totalUzs))}</span>
              </div>
            </div>

            {order.notes && (
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-400">{t("Izoh:")} <span className="text-gray-500">{order.notes}</span></p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!order && !orderQuery.isLoading && !orderQuery.error && (
          <div className="text-center py-16">
            <ClipboardList className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">{t("Buyurtma raqamini kiriting")}</p>
            <p className="text-xs text-gray-300">{t("Buyurtma holatini tekshirish uchun")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
