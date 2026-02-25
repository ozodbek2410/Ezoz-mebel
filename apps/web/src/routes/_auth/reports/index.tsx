import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Wallet } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input, Select, Tabs, Badge } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { formatUzs, formatUsd } from "@ezoz/shared";

const CHART_COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

function getToday(): string {
  return new Date().toISOString().split("T")[0]!;
}

function getMonthAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split("T")[0]!;
}

export function ReportsPage() {
  const { isBoss } = useAuth();
  const t = useT();
  const search = useSearch({ strict: false }) as Record<string, string>;
  const [activeTab, setActiveTab] = useState(search?.tab ?? (isBoss() ? "boss" : "cashier"));

  useEffect(() => {
    if (search?.tab) setActiveTab(search.tab);
  }, [search?.tab]);
  const [dateFrom, setDateFrom] = useState(getMonthAgo());
  const [dateTo, setDateTo] = useState(getToday());
  const [cashRegister, setCashRegister] = useState<string>("");
  const [chartDays, setChartDays] = useState(30);

  const cashierReport = useQuery({
    queryKey: ["report", "cashier", dateFrom, dateTo, cashRegister],
    queryFn: () =>
      trpc.report.dailyCashier.query({
        dateFrom,
        dateTo,
        cashRegister: cashRegister ? (cashRegister as "SALES" | "SERVICE") : undefined,
      }),
    enabled: activeTab === "cashier",
  });

  const bossReport = useQuery({
    queryKey: ["report", "boss", dateFrom, dateTo],
    queryFn: () => trpc.report.bossOverview.query({ dateFrom, dateTo }),
    enabled: activeTab === "boss" && isBoss(),
  });

  const inventoryReport = useQuery({
    queryKey: ["report", "inventory"],
    queryFn: () => trpc.report.inventoryReport.query({}),
    enabled: activeTab === "inventory",
  });

  const chartData = useQuery({
    queryKey: ["report", "salesChart", chartDays],
    queryFn: () => trpc.report.salesChart.query({ days: chartDays }),
    enabled: activeTab === "charts",
  });

  const topProducts = useQuery({
    queryKey: ["report", "topProducts", dateFrom, dateTo],
    queryFn: () => trpc.report.topProducts.query({ dateFrom, dateTo, limit: 10 }),
    enabled: activeTab === "charts",
  });

  return (
    <>
      <PageHeader title={t("Hisobotlar")} />

      <div className="page-body">
        <div className="mb-6">
          <Tabs
            tabs={[
              ...(isBoss() ? [{ id: "boss", label: t("Umumiy hisobot") }] : []),
              { id: "cashier", label: t("Kassir hisoboti") },
              { id: "charts", label: t("Diagrammalar") },
              { id: "inventory", label: t("Inventar") },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Date filters */}
        {activeTab !== "inventory" && activeTab !== "charts" && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 mb-6">
            <Input label={t("Dan")} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label={t("Gacha")} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            {activeTab === "cashier" && (
              <Select
                label={t("Kassa")}
                options={[
                  { value: "", label: t("Barchasi") },
                  { value: "SALES", label: t("Savdo") },
                  { value: "SERVICE", label: t("Xizmat") },
                ]}
                value={cashRegister}
                onChange={(e) => setCashRegister(e.target.value)}
              />
            )}
          </div>
        )}

        {/* Charts Tab */}
        {activeTab === "charts" && (
          <ChartsTab
            chartData={chartData.data ?? []}
            topProducts={topProducts.data ?? []}
            chartDays={chartDays}
            setChartDays={setChartDays}
            dateFrom={dateFrom}
            dateTo={dateTo}
            setDateFrom={setDateFrom}
            setDateTo={setDateTo}
          />
        )}

        {/* Cashier Report */}
        {activeTab === "cashier" && cashierReport.data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label={t("Sotuvlar soni")} value={String(cashierReport.data.salesCount)}
                icon={<ShoppingBag className="w-5 h-5 text-brand-600" />} />
              <StatCard label={t("Jami sotuvlar")} value={formatUzs(cashierReport.data.totalSalesUzs)}
                sub={formatUsd(cashierReport.data.totalSalesUsd)}
                icon={<DollarSign className="w-5 h-5 text-green-600" />} />
              <StatCard label={t("Xarajatlar")} value={formatUzs(cashierReport.data.totalExpensesUzs)}
                icon={<TrendingDown className="w-5 h-5 text-red-600" />} variant="danger" />
              <StatCard label={t("Sof foyda")} value={formatUzs(cashierReport.data.netUzs)}
                icon={<TrendingUp className="w-5 h-5 text-green-600" />}
                variant={cashierReport.data.netUzs >= 0 ? "success" : "danger"} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card card-body">
                <h4 className="text-sm font-medium text-gray-500 mb-3">{t("Tushumlar tafsiloti")}</h4>
                <div className="space-y-2">
                  <DetailRow label={t("Jami to'lovlar (UZS)")} value={formatUzs(cashierReport.data.totalPaymentsUzs)} />
                  <DetailRow label={t("Jami to'lovlar (USD)")} value={formatUsd(cashierReport.data.totalPaymentsUsd)} className="text-usd" />
                </div>
              </div>
              <div className="card card-body">
                <h4 className="text-sm font-medium text-gray-500 mb-3">{t("Xarajatlar tafsiloti")}</h4>
                <div className="space-y-2">
                  <DetailRow label={t("Xarajatlar (UZS)")} value={formatUzs(cashierReport.data.totalExpensesUzs)} className="text-red-600" />
                  <DetailRow label={t("Xarajatlar (USD)")} value={formatUsd(cashierReport.data.totalExpensesUsd)} className="text-red-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Boss Report */}
        {activeTab === "boss" && bossReport.data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label={t("Savdo kassa")} value={formatUzs(bossReport.data.salesCashUzs)}
                sub={formatUsd(bossReport.data.salesCashUsd)}
                icon={<Wallet className="w-5 h-5 text-brand-600" />} />
              <StatCard label={t("Xizmat kassa")} value={formatUzs(bossReport.data.serviceCashUzs)}
                sub={formatUsd(bossReport.data.serviceCashUsd)}
                icon={<Wallet className="w-5 h-5 text-cyan-600" />} />
              <StatCard label={t("Jami xarajatlar")} value={formatUzs(bossReport.data.totalExpensesUzs)}
                icon={<TrendingDown className="w-5 h-5 text-red-600" />} variant="danger" />
              <StatCard label={t("Sof foyda")} value={formatUzs(bossReport.data.netProfitUzs)}
                icon={<TrendingUp className="w-5 h-5 text-green-600" />}
                variant={bossReport.data.netProfitUzs >= 0 ? "success" : "danger"} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card card-body">
                <h4 className="text-sm font-medium text-gray-500 mb-3">{t("Savdo kassa")}</h4>
                <div className="space-y-2">
                  <DetailRow label={t("Tushum")} value={formatUzs(bossReport.data.salesCashUzs)} className="text-green-600" />
                  <DetailRow label={t("Xarajat")} value={formatUzs(bossReport.data.salesExpensesUzs)} className="text-red-600" />
                </div>
              </div>
              <div className="card card-body">
                <h4 className="text-sm font-medium text-gray-500 mb-3">{t("Xizmat kassa")}</h4>
                <div className="space-y-2">
                  <DetailRow label={t("Tushum")} value={formatUzs(bossReport.data.serviceCashUzs)} className="text-green-600" />
                  <DetailRow label={t("Xarajat")} value={formatUzs(bossReport.data.serviceExpensesUzs)} className="text-red-600" />
                </div>
              </div>
              <div className="card card-body">
                <h4 className="text-sm font-medium text-gray-500 mb-3">{t("Qo'shimcha")}</h4>
                <div className="space-y-2">
                  <DetailRow label={t("Avanslar")} value={formatUzs(bossReport.data.totalAdvancesUzs)} className="text-amber-600" />
                  <DetailRow label={t("Jami tushum")} value={formatUzs(bossReport.data.totalIncomeUzs)} className="text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inventory Report */}
        {activeTab === "inventory" && inventoryReport.data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label={t("Ombor qiymati (sotish)")} value={formatUzs(inventoryReport.data.totalValueUzs)} icon={<BarChart3 className="w-5 h-5 text-brand-600" />} />
              <StatCard label={t("Ombor qiymati (USD)")} value={formatUsd(inventoryReport.data.totalValueUsd)} icon={<DollarSign className="w-5 h-5 text-usd" />} />
              <StatCard label={t("Tan narxi")} value={formatUzs(inventoryReport.data.totalCostUzs)} icon={<BarChart3 className="w-5 h-5 text-gray-600" />} />
              <StatCard label={t("Potensial foyda")} value={formatUzs(inventoryReport.data.totalValueUzs - inventoryReport.data.totalCostUzs)} icon={<TrendingUp className="w-5 h-5 text-green-600" />} variant="success" />
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("Mahsulot")}</th>
                      <th className="hidden sm:table-cell">{t("Guruh")}</th>
                      <th className="hidden md:table-cell">{t("Ombor")}</th>
                      <th>{t("Qoldiq")}</th>
                      <th className="hidden sm:table-cell">{t("Sotish narxi")}</th>
                      <th className="hidden md:table-cell">{t("Tan narxi")}</th>
                      <th>{t("Jami qiymat")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryReport.data.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-medium">{item.productName}</td>
                        <td className="hidden sm:table-cell"><Badge variant="neutral">{item.category}</Badge></td>
                        <td className="text-sm text-gray-500 hidden md:table-cell">{item.warehouse}</td>
                        <td>{item.quantity}</td>
                        <td className="currency-uzs text-sm hidden sm:table-cell">{formatUzs(item.priceUzs)}</td>
                        <td className="text-sm text-gray-500 hidden md:table-cell">{formatUzs(item.costUzs)}</td>
                        <td className="currency-uzs font-medium">{formatUzs(item.totalPriceUzs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ===== Charts Tab =====
interface ChartEntry {
  date: string;
  salesUzs: number;
  expensesUzs: number;
  count: number;
}

interface TopProduct {
  productName: string;
  totalUzs: number;
  totalQty: number;
}

function ChartsTab({
  chartData,
  topProducts,
  chartDays,
  setChartDays,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
}: {
  chartData: ChartEntry[];
  topProducts: TopProduct[];
  chartDays: number;
  setChartDays: (d: number) => void;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (d: string) => void;
  setDateTo: (d: string) => void;
}) {
  const t = useT();
  const formatNum = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return String(v);
  };

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[7, 14, 30, 60].map((d) => (
            <button
              key={d}
              onClick={() => setChartDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                chartDays === d ? "bg-brand-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {d} {t("kun")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* Sales & Expenses Chart */}
      <div className="card card-body">
        <h3 className="font-semibold text-gray-900 mb-4">{t("Sotuvlar va xarajatlar")}</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
              fontSize={11}
              tick={{ fill: "#9ca3af" }}
            />
            <YAxis tickFormatter={formatNum} fontSize={11} tick={{ fill: "#9ca3af" }} />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatUzs(value),
                name === "salesUzs" ? t("Sotuvlar") : t("Xarajatlar"),
              ]}
              labelFormatter={(label: string) => new Date(label).toLocaleDateString("uz")}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
            />
            <Bar dataKey="salesUzs" name={t("Sotuvlar")} fill="#4f46e5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expensesUzs" name={t("Xarajatlar")} fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sales Count Line Chart */}
      <div className="card card-body">
        <h3 className="font-semibold text-gray-900 mb-4">{t("Sotuvlar soni (kunlik)")}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
              fontSize={11}
              tick={{ fill: "#9ca3af" }}
            />
            <YAxis fontSize={11} tick={{ fill: "#9ca3af" }} />
            <Tooltip
              formatter={(value: number) => [value, t("Sotuvlar")]}
              labelFormatter={(label: string) => new Date(label).toLocaleDateString("uz")}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
            />
            <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="card card-body">
          <h3 className="font-semibold text-gray-900 mb-4">{t("Top mahsulotlar (tushum bo'yicha)")}</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t("Ma'lumot yo'q")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={formatNum} fontSize={11} tick={{ fill: "#9ca3af" }} />
                <YAxis
                  type="category"
                  dataKey="productName"
                  width={120}
                  fontSize={11}
                  tick={{ fill: "#374151" }}
                  tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + "..." : v}
                />
                <Tooltip
                  formatter={(value: number) => [formatUzs(value), t("Tushum")]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Bar dataKey="totalUzs" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="card card-body">
          <h3 className="font-semibold text-gray-900 mb-4">{t("Mahsulot ulushi")}</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t("Ma'lumot yo'q")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topProducts}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="totalUzs"
                  nameKey="productName"
                  label={({ name, percent }: { name: string; percent: number }) =>
                    `${name?.slice(0, 10)} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                  fontSize={10}
                >
                  {topProducts.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatUzs(value), t("Tushum")]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper components
function StatCard({
  label, value, sub, icon, variant,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  variant?: "success" | "danger";
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="stat-card-label">{label}</span>
        {icon}
      </div>
      <p className={`stat-card-value truncate ${variant === "success" ? "text-green-600" : variant === "danger" ? "text-red-600" : ""}`}>
        {value}
      </p>
      {sub && <p className="stat-card-sub">{sub}</p>}
    </div>
  );
}

function DetailRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${className}`}>{value}</span>
    </div>
  );
}
