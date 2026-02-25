import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCurrencyStore } from "@/store/currency.store";
import { formatUzs } from "@ezoz/shared";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui";
import { useT } from "@/hooks/useT";
import {
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Wallet,
  Clock,
  AlertTriangle,
  Save,
  StickyNote,
  Wrench,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";

export function DashboardPage() {
  const t = useT();
  const { user, isBoss, isMaster } = useAuth();
  const { rate } = useCurrencyStore();

  const statsQuery = useQuery({
    queryKey: ["report", "dashboardStats"],
    queryFn: () => trpc.report.dashboardStats.query(),
    refetchInterval: 60000,
  });

  const stats = statsQuery.data;

  return (
    <>
      <PageHeader
        title={`${t("Xush kelibsiz")}, ${user?.fullName ?? ""}`}
        subtitle={rate ? `${t("Bugungi kurs")}: 1$ = ${rate.toLocaleString()} ${t("so'm")}` : undefined}
      />

      <div className="page-body">
        {/* Stats Cards - Today */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCardLink
            to="/reports"
            search={{ tab: "charts" }}
            label={t("Bugungi sotuvlar")}
            value={String(stats?.todaySalesCount ?? 0)}
            sub={`${t("Hafta")}: ${stats?.weekSalesCount ?? 0} | ${t("Oy")}: ${stats?.monthSalesCount ?? 0}`}
            icon={ShoppingCart}
            color="text-blue-600 bg-blue-100"
          />
          <StatCardLink
            to="/reports"
            search={isBoss() ? { tab: "boss" } : { tab: "cashier" }}
            label={t("Bugungi kirim")}
            value={formatUzs(stats?.todayIncomeUzs ?? 0)}
            sub={`${t("Oy")}: ${formatUzs(stats?.monthIncomeUzs ?? 0)}`}
            icon={TrendingUp}
            color="text-green-600 bg-green-100"
          />
          <StatCardLink
            to="/reports"
            search={isBoss() ? { tab: "boss" } : { tab: "cashier" }}
            label={t("Bugungi xarajatlar")}
            value={formatUzs(stats?.todayExpensesUzs ?? 0)}
            sub={t("barcha kassalar")}
            icon={Wallet}
            color="text-red-600 bg-red-100"
          />
          <StatCardLink
            to="/customers"
            label={t("Aktiv mijozlar")}
            value={String(stats?.activeCustomers ?? 0)}
            sub={`${stats?.totalDebtors ?? 0} ${t("ta qarzdor")}`}
            icon={Users}
            color="text-purple-600 bg-purple-100"
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentSalesCard sales={stats?.recentSales ?? []} />
          {isBoss() && <NotesCard />}
          {isMaster() && <WorkshopTasksCard />}
          <LowStockCard items={stats?.lowStockItems ?? []} />
        </div>
      </div>
    </>
  );
}

// ===== Clickable Stat Card =====
interface StatCardLinkProps {
  to: string;
  search?: Record<string, string>;
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
  trendColor?: string;
}

function StatCardLink({ to, search, label, value, sub, icon: Icon, color, trend, trendColor }: StatCardLinkProps) {
  return (
    <Link
      to={to}
      search={search}
      className="stat-card group relative overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <span className="stat-card-label">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-card-value truncate">{value}</div>
      <div className="flex items-center justify-between">
        <span className="stat-card-sub">{sub}</span>
        <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors" />
      </div>
    </Link>
  );
}

// ===== Recent Sales =====
interface RecentSale {
  id: number;
  documentNo: string;
  saleType: string;
  status: string;
  totalUzs: number;
  customerName: string | null;
  cashierName: string;
  createdAt: string | Date;
}

function RecentSalesCard({ sales }: { sales: RecentSale[] }) {
  const t = useT();
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ShoppingCart size={16} className="text-blue-500" />
          {t("So'nggi sotuvlar")}
        </h3>
        <Link to="/sales" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors">
          {t("Barchasi")} <ChevronRight size={14} />
        </Link>
      </div>
      <div className="card-body p-0">
        {sales.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t("Hali sotuvlar yo'q")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sales.map((sale) => (
              <div key={sale.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sale.saleType === "PRODUCT" ? "info" : "warning"}>
                      {sale.saleType === "PRODUCT" ? t("Savdo") : t("Xizmat")}
                    </Badge>
                    <Badge variant={sale.status === "COMPLETED" ? "success" : sale.status === "OPEN" ? "warning" : "neutral"}>
                      {sale.status === "COMPLETED" ? t("Yakunlangan") : sale.status === "OPEN" ? t("Ochiq") : sale.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {sale.customerName ?? t("Oddiy mijoz")} &middot; {sale.cashierName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatUzs(sale.totalUzs)}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(sale.createdAt).toLocaleTimeString("uz", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Notes =====
function NotesCard() {
  const t = useT();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const notesQuery = useQuery({
    queryKey: ["settings", "notes"],
    queryFn: () => trpc.settings.getNotes.query(),
  });

  useEffect(() => {
    if (notesQuery.data) {
      setContent(notesQuery.data.content);
    }
  }, [notesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => trpc.settings.saveNote.mutate({ content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "notes"] });
    },
  });

  // Auto-save every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (content && content !== notesQuery.data?.content) {
        saveMutation.mutate();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [content, notesQuery.data?.content]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <StickyNote size={16} className="text-amber-500" />
          <h3 className="font-semibold text-gray-900">{t("Eslatmalar")}</h3>
        </div>
        <span className="text-xs text-gray-400">{content.length}/800</span>
      </div>
      <div className="card-body">
        <textarea
          className="input-field resize-none h-32"
          placeholder={t("Eslatmalarni shu yerga yozing...")}
          maxLength={800}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">{t("Avtomatik saqlanadi")}</span>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <Save size={12} />
            {saveMutation.isPending ? t("Saqlanmoqda...") : t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Workshop Tasks (Master) =====
function WorkshopTasksCard() {
  const t = useT();
  const tasksQuery = useQuery({
    queryKey: ["workshop", "myTasks"],
    queryFn: () => trpc.workshop.list.query({ status: "PENDING" }),
  });

  const tasks = tasksQuery.data ?? [];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Wrench size={16} className="text-orange-500" />
          {t("Mening vazifalarim")}
        </h3>
        <Link to="/workshop" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors">
          {t("Barchasi")} {tasks.length > 0 && <Badge variant="warning">{tasks.length}</Badge>}
          <ChevronRight size={14} />
        </Link>
      </div>
      <div className="card-body p-0">
        {tasks.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Clock size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t("Hali vazifalar yo'q")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <p className="font-medium text-sm">{task.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {task.sale?.createdAt ? new Date(task.sale.createdAt).toLocaleDateString("uz") : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Low Stock =====
interface LowStockItem {
  productName: string;
  warehouseName: string;
  quantity: number;
  minAlert: number;
  unit: string;
}

function LowStockCard({ items }: { items: LowStockItem[] }) {
  const t = useT();
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          {t("Kam qolgan mahsulotlar")}
        </h3>
        <Link to="/products" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors">
          {t("Barchasi")} {items.length > 0 && <Badge variant="danger">{items.length}</Badge>}
          <ChevronRight size={14} />
        </Link>
      </div>
      <div className="card-body p-0">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Package size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t("Barcha mahsulotlar yetarli")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div>
                  <p className="font-medium text-sm">{item.productName}</p>
                  <p className="text-xs text-gray-400">{item.warehouseName}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${item.quantity <= 0 ? "text-red-600" : "text-amber-600"}`}>
                    {item.quantity} {item.unit}
                  </span>
                  <p className="text-xs text-gray-400">min: {item.minAlert}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
