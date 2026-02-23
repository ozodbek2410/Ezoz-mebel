import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCurrencyStore } from "@/store/currency.store";
import { formatUzs } from "@ezoz/shared";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui";
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
} from "lucide-react";

export function DashboardPage() {
  const { user, isBoss, isMaster } = useAuth();
  const { rate } = useCurrencyStore();

  const statsQuery = useQuery({
    queryKey: ["report", "dashboardStats"],
    queryFn: () => trpc.report.dashboardStats.query(),
    refetchInterval: 60000, // Refresh every minute
  });

  const stats = statsQuery.data;

  return (
    <>
      <PageHeader
        title={`Xush kelibsiz, ${user?.fullName ?? ""}`}
        subtitle={rate ? `Bugungi kurs: 1$ = ${rate.toLocaleString()} so'm` : undefined}
      />

      <div className="page-body">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Bugungi sotuvlar"
            value={String(stats?.todaySalesCount ?? 0)}
            sub="hujjat"
            icon={ShoppingCart}
            color="text-blue-600 bg-blue-100"
          />
          <StatCard
            label="Bugungi kirim"
            value={formatUzs(stats?.todayIncomeUzs ?? 0)}
            sub="naqd + karta"
            icon={TrendingUp}
            color="text-green-600 bg-green-100"
          />
          <StatCard
            label="Bugungi xarajatlar"
            value={formatUzs(stats?.todayExpensesUzs ?? 0)}
            sub="barcha kassalar"
            icon={Wallet}
            color="text-red-600 bg-red-100"
          />
          <StatCard
            label="Aktiv mijozlar"
            value={String(stats?.activeCustomers ?? 0)}
            sub="jami"
            icon={Users}
            color="text-purple-600 bg-purple-100"
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Sales */}
          <RecentSalesCard sales={stats?.recentSales ?? []} />

          {/* Notes for Boss */}
          {isBoss() && <NotesCard />}

          {/* Workshop tasks for master */}
          {isMaster() && <WorkshopTasksCard />}

          {/* Low stock alert */}
          <LowStockCard items={stats?.lowStockItems ?? []} />
        </div>
      </div>
    </>
  );
}

// ===== Stat Card =====
interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: string;
}

function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="stat-card-label">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-card-value truncate">{value}</div>
      <div className="stat-card-sub">{sub}</div>
    </div>
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
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ShoppingCart size={16} className="text-blue-500" />
          So'nggi sotuvlar
        </h3>
      </div>
      <div className="card-body p-0">
        {sales.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Hali sotuvlar yo'q</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sales.map((sale) => (
              <div key={sale.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">{sale.documentNo}</span>
                    <Badge variant={sale.saleType === "PRODUCT" ? "info" : "warning"}>
                      {sale.saleType === "PRODUCT" ? "Savdo" : "Xizmat"}
                    </Badge>
                    <Badge variant={sale.status === "COMPLETED" ? "success" : sale.status === "OPEN" ? "warning" : "neutral"}>
                      {sale.status === "COMPLETED" ? "Yakunlangan" : sale.status === "OPEN" ? "Ochiq" : sale.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {sale.customerName ?? "Nomsiz"} &middot; {sale.cashierName}
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
          <h3 className="font-semibold text-gray-900">Eslatmalar</h3>
        </div>
        <span className="text-xs text-gray-400">{content.length}/800</span>
      </div>
      <div className="card-body">
        <textarea
          className="input-field resize-none h-32"
          placeholder="Eslatmalarni shu yerga yozing..."
          maxLength={800}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">Avtomatik saqlanadi</span>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <Save size={12} />
            {saveMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Workshop Tasks (Master) =====
function WorkshopTasksCard() {
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
          Mening vazifalarim
        </h3>
        {tasks.length > 0 && (
          <Badge variant="warning">{tasks.length}</Badge>
        )}
      </div>
      <div className="card-body p-0">
        {tasks.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Clock size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Hali vazifalar yo'q</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="px-5 py-3">
                <p className="font-medium text-sm">{task.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {task.sale?.createdAt ? new Date(task.sale.createdAt).toLocaleDateString("uz") : ""}
                </p>
              </div>
            ))}
            {tasks.length > 5 && (
              <div className="px-5 py-2 text-center">
                <a href="/workshop" className="text-xs text-brand-600 hover:text-brand-700">
                  Barchasini ko'rish ({tasks.length})
                </a>
              </div>
            )}
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
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          Kam qolgan mahsulotlar
        </h3>
        {items.length > 0 && (
          <Badge variant="danger">{items.length}</Badge>
        )}
      </div>
      <div className="card-body p-0">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Package size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Barcha mahsulotlar yetarli</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <div key={idx} className="px-5 py-3 flex items-center justify-between">
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
