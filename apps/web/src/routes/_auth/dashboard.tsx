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
  ChevronRight,
  DollarSign,
  BarChart3,
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

  // Calculate gross profit estimate and average check from available data
  const avgCheck = stats && stats.todaySalesCount > 0
    ? Math.round(stats.todayIncomeUzs / stats.todaySalesCount)
    : 0;

  return (
    <div className="page-enter">
      <PageHeader title={`${t("Bosh sahifa")}`} />

      <div className="page-body space-y-6">
        {/* Greeting + currency */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t("Xush kelibsiz")}, {user?.fullName ?? ""}
            </h2>
            {rate && (
              <p className="text-sm text-slate-500 mt-0.5">
                {t("Bugungi kurs")}: <span className="font-medium text-slate-700">1$ = {rate.toLocaleString()} {t("so'm")}</span>
              </p>
            )}
          </div>
        </div>

        {/* Main stat cards — Regos style */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            to="/reports"
            search={{ tab: "charts" }}
            label={t("Bugungi sotuvlar")}
            value={String(stats?.todaySalesCount ?? 0)}
            sub={`${t("Hafta")}: ${stats?.weekSalesCount ?? 0} | ${t("Oy")}: ${stats?.monthSalesCount ?? 0}`}
            icon={ShoppingCart}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-500"
          />
          <StatCard
            to="/reports"
            search={isBoss() ? { tab: "boss" } : { tab: "cashier" }}
            label={t("Bugungi kirim")}
            value={formatUzs(stats?.todayIncomeUzs ?? 0)}
            sub={`${t("Oy")}: ${formatUzs(stats?.monthIncomeUzs ?? 0)}`}
            icon={TrendingUp}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-500"
          />
          <StatCard
            to="/expenses"
            label={t("Bugungi xarajatlar")}
            value={formatUzs(stats?.todayExpensesUzs ?? 0)}
            sub={t("barcha kassalar")}
            icon={Wallet}
            iconBg="bg-cyan-50"
            iconColor="text-cyan-500"
          />
          <StatCard
            to="/customers"
            label={t("Aktiv mijozlar")}
            value={String(stats?.activeCustomers ?? 0)}
            sub={`${stats?.totalDebtors ?? 0} ${t("ta qarzdor")}`}
            icon={Users}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
          />
        </div>

        {/* Second row — small stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MiniStatCard
            label={t("O'rtacha chek")}
            value={avgCheck > 0 ? formatUzs(avgCheck) : "—"}
            icon={BarChart3}
          />
          <MiniStatCard
            label={t("Haftalik kirim")}
            value={formatUzs(stats?.weekIncomeUzs ?? 0)}
            icon={DollarSign}
          />
          <MiniStatCard
            label={t("Oylik sotuvlar")}
            value={String(stats?.monthSalesCount ?? 0)}
            sub={t("ta chek")}
            icon={ShoppingCart}
            className="hidden lg:block"
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
    </div>
  );
}

// ===== Stat Card (Regos Style) =====
interface StatCardProps {
  to: string;
  search?: Record<string, string>;
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

function StatCard({ to, search, label, value, sub, icon: Icon, iconBg, iconColor }: StatCardProps) {
  return (
    <Link
      to={to}
      search={search}
      className="stat-card group cursor-pointer hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-center justify-between">
        <p className="stat-card-label">{label}</p>
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
      <p className="stat-card-value truncate">{value}</p>
      <p className="stat-card-sub">{sub}</p>
    </Link>
  );
}

// ===== Mini Stat Card =====
interface MiniStatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  className?: string;
}

function MiniStatCard({ label, value, sub, icon: Icon, className = "" }: MiniStatCardProps) {
  return (
    <div className={`bg-white rounded-lg p-4 border border-slate-200 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-slate-400" />
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-bold text-slate-900">
        {value}
        {sub && <span className="text-xs font-normal text-slate-400 ml-1">{sub}</span>}
      </p>
    </div>
  );
}

// ===== Recent Sales (Regos List Style) =====
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
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <ShoppingCart size={16} className="text-indigo-500" />
          {t("So'nggi sotuvlar")}
        </h3>
        <Link to="/receipts" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
          {t("Barchasi")} <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-0">
        {sales.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart className="empty-state-icon" />
            <p className="empty-state-title">{t("Hali sotuvlar yo'q")}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sales.map((sale) => (
              <div key={sale.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sale.saleType === "PRODUCT" ? "info" : "warning"}>
                      {sale.saleType === "PRODUCT" ? t("Savdo") : t("Xizmat")}
                    </Badge>
                    <Badge variant={sale.status === "COMPLETED" ? "success" : sale.status === "OPEN" ? "warning" : "neutral"}>
                      {sale.status === "COMPLETED" ? t("Yakunlangan") : sale.status === "OPEN" ? t("Ochiq") : sale.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {sale.customerName ?? t("Oddiy mijoz")} &middot; {sale.cashierName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm text-slate-900">{formatUzs(sale.totalUzs)}</p>
                  <p className="text-xs text-slate-400">
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
          <h3 className="text-base font-semibold text-slate-900">{t("Eslatmalar")}</h3>
        </div>
        <span className="text-xs text-slate-400">{content.length}/800</span>
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
          <span className="text-xs text-slate-400">{t("Avtomatik saqlanadi")}</span>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
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
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Wrench size={16} className="text-orange-500" />
          {t("Mening vazifalarim")}
        </h3>
        <Link to="/workshop" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
          {t("Barchasi")} {tasks.length > 0 && <Badge variant="warning">{tasks.length}</Badge>}
          <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-0">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <Clock className="empty-state-icon" />
            <p className="empty-state-title">{t("Hali vazifalar yo'q")}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                <p className="font-medium text-sm text-slate-900">{task.description}</p>
                <p className="text-xs text-slate-400 mt-0.5">
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
  quantity: number;
  minAlert: number;
  unit: string;
}

function LowStockCard({ items }: { items: LowStockItem[] }) {
  const t = useT();
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          {t("Kam qolgan mahsulotlar")}
        </h3>
        <Link to="/products" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
          {t("Barchasi")} {items.length > 0 && <Badge variant="danger">{items.length}</Badge>}
          <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-0">
        {items.length === 0 ? (
          <div className="empty-state">
            <Package className="empty-state-icon" />
            <p className="empty-state-title">{t("Barcha mahsulotlar yetarli")}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-medium text-sm text-slate-900">{item.productName}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${item.quantity <= 0 ? "text-red-600" : "text-amber-600"}`}>
                    {item.quantity} {item.unit}
                  </span>
                  <p className="text-xs text-slate-400">min: {item.minAlert}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
