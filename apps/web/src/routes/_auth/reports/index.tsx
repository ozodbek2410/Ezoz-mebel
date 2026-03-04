import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useNavigate } from "@tanstack/react-router";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Wallet, Download, Package, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input, Select, Tabs, Badge, SearchInput } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { formatUzs, formatUsd } from "@ezoz/shared";
import { exportToExcel } from "@/lib/exportExcel";

const CHART_COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

function getLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getToday(): string {
  return getLocalDateStr(new Date());
}

function getMonthAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return getLocalDateStr(d);
}

export function ReportsPage() {
  const { isBoss } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string>;
  const [activeTab, setActiveTab] = useState(search?.tab ?? (isBoss() ? "boss" : "cashier"));
  const [filterProductId, setFilterProductId] = useState<number | undefined>(
    search?.productId ? Number(search.productId) : undefined,
  );

  useEffect(() => {
    if (search?.tab) setActiveTab(search.tab);
    if (search?.productId) setFilterProductId(Number(search.productId));
  }, [search?.tab, search?.productId]);
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

  const productSalesReport = useQuery({
    queryKey: ["report", "productSales", dateFrom, dateTo, filterProductId],
    queryFn: () => trpc.report.productSalesReport.query({ dateFrom, dateTo, productId: filterProductId }),
    enabled: activeTab === "products",
  });

  return (
    <div className="page-enter">
      <PageHeader title={t("Hisobotlar")} />

      <div className="page-body">
        <div className="mb-6">
          <Tabs
            tabs={[
              ...(isBoss() ? [{ id: "boss", label: t("Umumiy hisobot") }] : []),
              { id: "cashier", label: t("Kassir hisoboti") },
              { id: "products", label: t("Mahsulotlar") },
              { id: "charts", label: t("Diagrammalar") },
              { id: "inventory", label: t("Inventar") },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Date filters */}
        {activeTab !== "inventory" && activeTab !== "charts" && activeTab !== "products" && (
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
            <div className="flex justify-end mb-2">
              <button
                className="btn-sm flex items-center gap-1.5 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
                onClick={() => {
                  const d = cashierReport.data;
                  if (!d) return;
                  exportToExcel({
                    filename: `kassir-hisobot_${dateFrom}_${dateTo}`,
                    sheetName: t("Kassir hisoboti"),
                    columns: [
                      { header: t("Ko'rsatkich"), key: "label", width: 25 },
                      { header: t("Qiymat"), key: "value", width: 20 },
                    ],
                    data: [
                      { label: t("Sotuvlar soni"), value: d.salesCount },
                      { label: t("Jami sotuvlar (UZS)"), value: d.totalSalesUzs },
                      { label: t("Jami sotuvlar (USD)"), value: d.totalSalesUsd },
                      { label: t("Jami to'lovlar (UZS)"), value: d.totalPaymentsUzs },
                      { label: t("Jami to'lovlar (USD)"), value: d.totalPaymentsUsd },
                      { label: t("Xarajatlar (UZS)"), value: d.totalExpensesUzs },
                      { label: t("Xarajatlar (USD)"), value: d.totalExpensesUsd },
                      { label: t("Sof foyda (UZS)"), value: d.netUzs },
                    ],
                  });
                }}
              >
                <Download size={14} />
                Excel
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label={t("Sotuvlar soni")} value={String(cashierReport.data.salesCount)}
                icon={<ShoppingBag className="w-5 h-5 text-indigo-600" />} />
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
                <h4 className="text-sm font-medium text-slate-500 mb-3">{t("Tushumlar tafsiloti")}</h4>
                <div className="space-y-2">
                  <DetailRow label={t("Jami to'lovlar (UZS)")} value={formatUzs(cashierReport.data.totalPaymentsUzs)} />
                  <DetailRow label={t("Jami to'lovlar (USD)")} value={formatUsd(cashierReport.data.totalPaymentsUsd)} className="text-usd" />
                </div>
              </div>
              <div className="card card-body">
                <h4 className="text-sm font-medium text-slate-500 mb-3">{t("Xarajatlar tafsiloti")}</h4>
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
            <div className="flex justify-end mb-2">
              <button
                className="btn-sm flex items-center gap-1.5 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
                onClick={() => {
                  const d = bossReport.data;
                  if (!d) return;
                  exportToExcel({
                    filename: `umumiy-hisobot_${dateFrom}_${dateTo}`,
                    sheetName: t("Umumiy hisobot"),
                    columns: [
                      { header: t("Ko'rsatkich"), key: "label", width: 25 },
                      { header: t("UZS"), key: "uzs", width: 20 },
                      { header: t("USD"), key: "usd", width: 15 },
                    ],
                    data: [
                      { label: t("Savdo kassa tushum"), uzs: d.salesCashUzs, usd: d.salesCashUsd },
                      { label: t("Savdo kassa xarajat"), uzs: d.salesExpensesUzs, usd: 0 },
                      { label: t("Xizmat kassa tushum"), uzs: d.serviceCashUzs, usd: d.serviceCashUsd },
                      { label: t("Xizmat kassa xarajat"), uzs: d.serviceExpensesUzs, usd: 0 },
                      { label: t("Jami xarajatlar"), uzs: d.totalExpensesUzs, usd: 0 },
                      { label: t("Avanslar"), uzs: d.totalAdvancesUzs, usd: 0 },
                      { label: t("Jami tushum"), uzs: d.totalIncomeUzs, usd: 0 },
                      { label: t("Sof foyda"), uzs: d.netProfitUzs, usd: 0 },
                    ],
                  });
                }}
              >
                <Download size={14} />
                Excel
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label={t("Savdo kassa")} value={formatUzs(bossReport.data.salesCashUzs)}
                sub={formatUsd(bossReport.data.salesCashUsd)}
                icon={<Wallet className="w-5 h-5 text-indigo-600" />} />
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
                <h4 className="text-sm font-medium text-slate-500 mb-3">{t("Savdo kassa")}</h4>
                <div className="space-y-2">
                  <DetailRow label={t("Tushum")} value={formatUzs(bossReport.data.salesCashUzs)} className="text-green-600" />
                  <DetailRow label={t("Xarajat")} value={formatUzs(bossReport.data.salesExpensesUzs)} className="text-red-600" />
                </div>
              </div>
              <div className="card card-body">
                <h4 className="text-sm font-medium text-slate-500 mb-3">{t("Xizmat kassa")}</h4>
                <div className="space-y-2">
                  <DetailRow label={t("Tushum")} value={formatUzs(bossReport.data.serviceCashUzs)} className="text-green-600" />
                  <DetailRow label={t("Xarajat")} value={formatUzs(bossReport.data.serviceExpensesUzs)} className="text-red-600" />
                </div>
              </div>
              <div className="card card-body">
                <h4 className="text-sm font-medium text-slate-500 mb-3">{t("Qo'shimcha")}</h4>
                <div className="space-y-2">
                  <DetailRow label={t("Avanslar")} value={formatUzs(bossReport.data.totalAdvancesUzs)} className="text-amber-600" />
                  <DetailRow label={t("Jami tushum")} value={formatUzs(bossReport.data.totalIncomeUzs)} className="text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Product Sales Report */}
        {activeTab === "products" && (
          <ProductSalesTab
            data={productSalesReport.data ?? []}
            isLoading={productSalesReport.isLoading}
            dateFrom={dateFrom}
            dateTo={dateTo}
            setDateFrom={setDateFrom}
            setDateTo={setDateTo}
            productId={filterProductId}
            onClearProduct={() => {
              setFilterProductId(undefined);
              navigate({ to: "/reports", search: { tab: "products" } });
            }}
          />
        )}

        {/* Inventory Report */}
        {activeTab === "inventory" && inventoryReport.data && (
          <div className="space-y-6">
            <div className="flex justify-end mb-2">
              <button
                className="btn-sm flex items-center gap-1.5 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
                onClick={() => {
                  const d = inventoryReport.data;
                  if (!d) return;
                  exportToExcel({
                    filename: `inventar-hisobot_${new Date().toISOString().split("T")[0]}`,
                    sheetName: t("Inventar"),
                    columns: [
                      { header: "#", key: "idx", width: 5 },
                      { header: t("Mahsulot"), key: "name", width: 25 },
                      { header: t("Guruh"), key: "category", width: 15 },
                      { header: t("Qoldiq"), key: "qty", width: 10 },
                      { header: t("Sotish narxi (UZS)"), key: "price", width: 18 },
                      { header: t("Tan narxi (UZS)"), key: "cost", width: 18 },
                      { header: t("Jami qiymat (UZS)"), key: "total", width: 18 },
                    ],
                    data: d.items.map((item, idx) => ({
                      idx: idx + 1,
                      name: item.productName,
                      category: item.category,
                      qty: item.quantity,
                      price: item.priceUzs,
                      cost: item.costUzs,
                      total: item.totalPriceUzs,
                    })),
                  });
                }}
              >
                <Download size={14} />
                Excel
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label={t("Ombor qiymati (sotish)")} value={formatUzs(inventoryReport.data.totalValueUzs)} icon={<BarChart3 className="w-5 h-5 text-indigo-600" />} />
              <StatCard label={t("Ombor qiymati (USD)")} value={formatUsd(inventoryReport.data.totalValueUsd)} icon={<DollarSign className="w-5 h-5 text-usd" />} />
              <StatCard label={t("Tan narxi")} value={formatUzs(inventoryReport.data.totalCostUzs)} icon={<BarChart3 className="w-5 h-5 text-slate-600" />} />
              <StatCard label={t("Potensial foyda")} value={formatUzs(inventoryReport.data.totalValueUzs - inventoryReport.data.totalCostUzs)} icon={<TrendingUp className="w-5 h-5 text-green-600" />} variant="success" />
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("Mahsulot")}</th>
                      <th className="hidden sm:table-cell">{t("Guruh")}</th>
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
                        <td>{item.quantity}</td>
                        <td className="currency-uzs text-sm hidden sm:table-cell">{formatUzs(item.priceUzs)}</td>
                        <td className="text-sm text-slate-500 hidden md:table-cell">{formatUzs(item.costUzs)}</td>
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
    </div>
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
        <div className="toggle-group">
          {[7, 14, 30, 60].map((d) => (
            <button
              key={d}
              onClick={() => setChartDays(d)}
              className={chartDays === d ? "toggle-group-btn toggle-group-btn-active" : "toggle-group-btn toggle-group-btn-inactive"}
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
        <h3 className="font-semibold text-slate-900 mb-4">{t("Sotuvlar va xarajatlar")}</h3>
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
        <h3 className="font-semibold text-slate-900 mb-4">{t("Sotuvlar soni (kunlik)")}</h3>
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
          <h3 className="font-semibold text-slate-900 mb-4">{t("Top mahsulotlar (tushum bo'yicha)")}</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{t("Ma'lumot yo'q")}</p>
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
          <h3 className="font-semibold text-slate-900 mb-4">{t("Mahsulot ulushi")}</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{t("Ma'lumot yo'q")}</p>
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

// ===== Product Sales Tab =====
interface ProductSaleItem {
  saleDate: string;
  documentNo: string;
  customerName: string | null;
  cashierName: string;
  productId: number;
  productName: string;
  productCode: string;
  categoryName: string;
  unit: string;
  quantity: number;
  unitPriceUzs: number;
  totalUzs: number;
  totalUsd: number;
}

type GroupBy = "none" | "category" | "product" | "customer" | "date" | "month";

interface GroupedRow {
  key: string;
  label: string;
  category: string;
  unit: string;
  quantity: number;
  totalUzs: number;
  totalUsd: number;
  count: number;
}

interface CategorySection {
  category: string;
  products: GroupedRow[];
  totalQty: number;
  totalUzs: number;
  totalUsd: number;
  count: number;
}

function groupByCategories(data: ProductSaleItem[]): CategorySection[] {
  const catMap = new Map<string, Map<number, { name: string; code: string; unit: string; qty: number; uzs: number; usd: number; count: number }>>();
  for (const item of data) {
    let productMap = catMap.get(item.categoryName);
    if (!productMap) {
      productMap = new Map();
      catMap.set(item.categoryName, productMap);
    }
    const existing = productMap.get(item.productId);
    if (existing) {
      existing.qty += item.quantity;
      existing.uzs += item.totalUzs;
      existing.usd += item.totalUsd;
      existing.count += 1;
    } else {
      productMap.set(item.productId, { name: item.productName, code: item.productCode, unit: item.unit, qty: item.quantity, uzs: item.totalUzs, usd: item.totalUsd, count: 1 });
    }
  }
  const sections: CategorySection[] = [];
  for (const [category, productMap] of catMap) {
    const products: GroupedRow[] = Array.from(productMap.entries())
      .map(([id, p]) => ({ key: String(id), label: `${p.name} (${p.code})`, category, unit: p.unit, quantity: p.qty, totalUzs: p.uzs, totalUsd: p.usd, count: p.count }))
      .sort((a, b) => b.totalUzs - a.totalUzs);
    sections.push({
      category,
      products,
      totalQty: products.reduce((s, p) => s + p.quantity, 0),
      totalUzs: products.reduce((s, p) => s + p.totalUzs, 0),
      totalUsd: products.reduce((s, p) => s + p.totalUsd, 0),
      count: products.reduce((s, p) => s + p.count, 0),
    });
  }
  sections.sort((a, b) => b.totalUzs - a.totalUzs);
  return sections;
}

function groupData(data: ProductSaleItem[], groupBy: GroupBy): GroupedRow[] {
  if (groupBy === "none" || groupBy === "category") return [];
  const map = new Map<string, GroupedRow>();
  for (const item of data) {
    let key: string;
    let label: string;
    switch (groupBy) {
      case "product":
        key = `${item.productId}`;
        label = `${item.productName} (${item.productCode})`;
        break;
      case "customer":
        key = item.customerName ?? "__no_customer__";
        label = item.customerName ?? "Oddiy mijoz";
        break;
      case "date":
        key = new Date(item.saleDate).toISOString().split("T")[0] ?? "";
        label = new Date(item.saleDate).toLocaleDateString("uz");
        break;
      case "month": {
        const d = new Date(item.saleDate);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        label = d.toLocaleDateString("uz", { year: "numeric", month: "long" });
        break;
      }
    }
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.totalUzs += item.totalUzs;
      existing.totalUsd += item.totalUsd;
      existing.count += 1;
    } else {
      map.set(key, { key, label, category: item.categoryName, unit: item.unit, quantity: item.quantity, totalUzs: item.totalUzs, totalUsd: item.totalUsd, count: 1 });
    }
  }
  const rows = Array.from(map.values());
  if (groupBy === "date" || groupBy === "month") {
    rows.sort((a, b) => a.key.localeCompare(b.key));
  } else {
    rows.sort((a, b) => b.totalUzs - a.totalUzs);
    if (groupBy === "customer") {
      const noCustomer = rows.findIndex((r) => r.key === "__no_customer__");
      if (noCustomer > -1) {
        const [removed] = rows.splice(noCustomer, 1);
        if (removed) rows.push(removed);
      }
    }
  }
  return rows;
}

function ProductSalesTab({
  data,
  isLoading,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  productId,
  onClearProduct,
}: {
  data: ProductSaleItem[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (d: string) => void;
  setDateTo: (d: string) => void;
  productId?: number;
  onClearProduct: () => void;
}) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");

  const productName = productId && data.length > 0 ? data[0]?.productName : undefined;

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      item.productName.toLowerCase().includes(q) ||
      item.productCode.toLowerCase().includes(q) ||
      (item.customerName && item.customerName.toLowerCase().includes(q))
    );
  }, [data, search]);

  const grouped = useMemo(() => groupData(filtered, groupBy), [filtered, groupBy]);
  const categoryGroups = useMemo(() => groupBy === "category" ? groupByCategories(filtered) : [], [filtered, groupBy]);

  const totals = useMemo(() => filtered.reduce(
    (acc, item) => ({
      qty: acc.qty + item.quantity,
      uzs: acc.uzs + item.totalUzs,
      usd: acc.usd + item.totalUsd,
    }),
    { qty: 0, uzs: 0, usd: 0 },
  ), [filtered]);

  const groupByOptions: Array<{ value: GroupBy; label: string }> = [
    { value: "category", label: t("Guruh bo'yicha") },
    { value: "product", label: t("Mahsulot bo'yicha") },
    { value: "customer", label: t("Mijoz bo'yicha") },
    { value: "date", label: t("Kun bo'yicha") },
    { value: "month", label: t("Oy bo'yicha") },
    { value: "none", label: t("Batafsil ro'yxat") },
  ];

  return (
    <div className="space-y-4">
      {/* Product filter header */}
      {productId && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
          <button
            onClick={onClearProduct}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <ArrowLeft size={16} />
            {t("Barcha mahsulotlar")}
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-medium text-slate-900">
            {productName ?? `#${productId}`}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
        <Input label={t("Dan")} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input label={t("Gacha")} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Select
          label={t("Guruhlash")}
          options={groupByOptions.map((o) => ({ value: o.value, label: o.label }))}
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
        />
        {!productId && (
          <div className="flex-1">
            <SearchInput
              placeholder={t("Mahsulot, mijoz qidirish...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
            />
          </div>
        )}
        <button
          className="flex items-center gap-1.5 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-2 rounded-lg transition-colors shrink-0"
          onClick={() => {
            const titleText = `${t("Mahsulotlar hisoboti")} (${dateFrom} — ${dateTo})`;
            if (groupBy === "category") {
              const excelRows: Array<Record<string, string | number>> = [];
              let num = 0;
              for (const section of categoryGroups) {
                excelRows.push({ idx: "", product: `>>> ${section.category}`, category: section.category, unit: "", count: section.count, qty: Math.round(section.totalQty), uzs: section.totalUzs, usd: section.totalUsd });
                for (const p of section.products) {
                  num++;
                  excelRows.push({ idx: num, product: p.label, category: p.category, unit: p.unit, count: p.count, qty: Math.round(p.quantity), uzs: p.totalUzs, usd: p.totalUsd });
                }
              }
              excelRows.push({ idx: "", product: t("JAMI"), category: "", unit: "", count: filtered.length, qty: Math.round(totals.qty), uzs: totals.uzs, usd: totals.usd });
              exportToExcel({
                filename: `mahsulot-hisobot_${dateFrom}_${dateTo}`,
                sheetName: t("Mahsulotlar hisoboti"),
                title: titleText,
                columns: [
                  { header: "#", key: "idx", width: 6 },
                  { header: t("Mahsulot nomi"), key: "product", width: 32 },
                  { header: t("Guruh"), key: "category", width: 18 },
                  { header: t("O'lchov"), key: "unit", width: 10 },
                  { header: t("Sotuvlar"), key: "count", width: 12 },
                  { header: t("Miqdor"), key: "qty", width: 12 },
                  { header: t("Jami (UZS)"), key: "uzs", width: 22 },
                  { header: t("Jami ($)"), key: "usd", width: 16 },
                ],
                data: excelRows,
              });
            } else if (groupBy !== "none") {
              const excelData = grouped.map((row, idx) => ({
                idx: idx + 1,
                label: row.label,
                ...(groupBy === "product" ? { category: row.category, unit: row.unit } : {}),
                count: row.count,
                qty: Math.round(row.quantity),
                uzs: row.totalUzs,
                usd: row.totalUsd,
              }));
              excelData.push({ idx: "" as unknown as number, label: t("JAMI"), ...(groupBy === "product" ? { category: "", unit: "" } : {}), count: filtered.length, qty: Math.round(totals.qty), uzs: totals.uzs, usd: totals.usd });
              exportToExcel({
                filename: `mahsulot-hisobot_${dateFrom}_${dateTo}`,
                sheetName: t("Mahsulotlar hisoboti"),
                title: titleText,
                columns: [
                  { header: "#", key: "idx", width: 6 },
                  { header: t("Nomi"), key: "label", width: 32 },
                  ...(groupBy === "product" ? [{ header: t("Guruh"), key: "category", width: 18 }, { header: t("O'lchov"), key: "unit", width: 10 }] : []),
                  { header: t("Sotuvlar"), key: "count", width: 12 },
                  { header: t("Miqdor"), key: "qty", width: 12 },
                  { header: t("Jami (UZS)"), key: "uzs", width: 22 },
                  { header: t("Jami ($)"), key: "usd", width: 16 },
                ],
                data: excelData,
              });
            } else {
              const excelData = filtered.map((item, idx) => ({
                idx: idx + 1,
                date: new Date(item.saleDate).toLocaleDateString("uz"),
                customer: item.customerName ?? t("Oddiy mijoz"),
                product: item.productName,
                code: item.productCode,
                category: item.categoryName,
                unit: item.unit,
                qty: item.quantity,
                price: item.unitPriceUzs,
                uzs: item.totalUzs,
                usd: item.totalUsd,
              }));
              excelData.push({ idx: "" as unknown as number, date: "", customer: "", product: t("JAMI"), code: "", category: "", unit: "", qty: Math.round(totals.qty), price: 0, uzs: totals.uzs, usd: totals.usd });
              exportToExcel({
                filename: `mahsulot-sotuvlar_${dateFrom}_${dateTo}`,
                sheetName: t("Mahsulotlar hisoboti"),
                title: titleText,
                columns: [
                  { header: "#", key: "idx", width: 6 },
                  { header: t("Sana"), key: "date", width: 14 },
                  { header: t("Mijoz"), key: "customer", width: 22 },
                  { header: t("Mahsulot nomi"), key: "product", width: 28 },
                  { header: t("Kod"), key: "code", width: 10 },
                  { header: t("Guruh"), key: "category", width: 16 },
                  { header: t("O'lchov"), key: "unit", width: 10 },
                  { header: t("Miqdor"), key: "qty", width: 10 },
                  { header: t("Narx (UZS)"), key: "price", width: 20 },
                  { header: t("Jami (UZS)"), key: "uzs", width: 22 },
                  { header: t("Jami ($)"), key: "usd", width: 16 },
                ],
                data: excelData,
              });
            }
          }}
        >
          <Download size={14} />
          Excel
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t("Sotuvlar soni")} value={String(filtered.length)} icon={<ShoppingBag className="w-5 h-5 text-indigo-600" />} />
        <StatCard label={t("Jami miqdor")} value={String(Math.round(totals.qty))} icon={<Package className="w-5 h-5 text-cyan-600" />} />
        <StatCard label={t("Jami summa")} value={formatUzs(totals.uzs)} icon={<DollarSign className="w-5 h-5 text-green-600" />} />
        {totals.usd > 0 && <StatCard label={t("Jami (USD)")} value={formatUsd(totals.usd)} icon={<DollarSign className="w-5 h-5 text-blue-600" />} />}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {groupBy === "category" ? (
            /* Category grouped table — full columns with borders */
            <table className="report-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">#</th>
                  <th>{t("Mahsulot nomi")}</th>
                  <th>{t("Guruh")}</th>
                  <th className="text-center">{t("O'lchov")}</th>
                  <th className="text-center">{t("Sotuvlar")}</th>
                  <th className="text-center">{t("Miqdor")}</th>
                  <th className="text-right">{t("Jami (UZS)")}</th>
                  <th className="text-right">{t("Jami ($)")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400">{t("Yuklanmoqda...")}</td></tr>
                ) : categoryGroups.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400">{t("Ma'lumot topilmadi")}</td></tr>
                ) : (
                  <>
                    {categoryGroups.map((section) => (
                      <>
                        <tr key={`cat-${section.category}`} className="!bg-indigo-100">
                          <td className="font-bold text-center text-indigo-800"></td>
                          <td className="font-bold text-indigo-900 uppercase tracking-wide" colSpan={2}>{section.category} <span className="text-xs font-semibold text-indigo-500 normal-case tracking-normal">({section.products.length} {t("mahsulot")})</span></td>
                          <td className="text-center font-bold text-indigo-800"></td>
                          <td className="text-center font-bold text-indigo-800">{section.count}</td>
                          <td className="text-center font-bold text-indigo-800">{Math.round(section.totalQty)}</td>
                          <td className="text-right font-bold text-indigo-800">{formatUzs(section.totalUzs)}</td>
                          <td className="text-right font-bold text-indigo-800">{section.totalUsd > 0 ? formatUsd(section.totalUsd) : ""}</td>
                        </tr>
                        {section.products.map((p, pIdx) => (
                          <tr key={`p-${p.key}`}>
                            <td className="text-center text-slate-500">{pIdx + 1}</td>
                            <td className="font-medium">{p.label}</td>
                            <td className="text-slate-500">{p.category}</td>
                            <td className="text-center">{p.unit}</td>
                            <td className="text-center">{p.count}</td>
                            <td className="text-center font-medium">{Math.round(p.quantity)}</td>
                            <td className="text-right font-semibold">{formatUzs(p.totalUzs)}</td>
                            <td className="text-right text-blue-600">{p.totalUsd > 0 ? formatUsd(p.totalUsd) : ""}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </>
                )}
              </tbody>
              {categoryGroups.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} className="text-right">{t("Jami")}:</td>
                    <td className="text-center">{filtered.length}</td>
                    <td className="text-center">{Math.round(totals.qty)}</td>
                    <td className="text-right">{formatUzs(totals.uzs)}</td>
                    <td className="text-right text-blue-700">{totals.usd > 0 ? formatUsd(totals.usd) : ""}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : groupBy !== "none" ? (
            /* Other grouped tables (product, customer, date, month) */
            <table className="report-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">#</th>
                  <th>{groupBy === "product" ? t("Mahsulot") : groupBy === "customer" ? t("Mijoz") : groupBy === "date" ? t("Sana") : t("Oy")}</th>
                  {groupBy === "product" && <th>{t("Guruh")}</th>}
                  {groupBy === "product" && <th className="text-center">{t("O'lchov")}</th>}
                  <th className="text-center">{t("Sotuvlar")}</th>
                  <th className="text-center">{t("Miqdor")}</th>
                  <th className="text-right">{t("Jami (UZS)")}</th>
                  <th className="text-right">{t("Jami ($)")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={groupBy === "product" ? 8 : 6} className="text-center py-8 text-slate-400">{t("Yuklanmoqda...")}</td></tr>
                ) : grouped.length === 0 ? (
                  <tr><td colSpan={groupBy === "product" ? 8 : 6} className="text-center py-8 text-slate-400">{t("Ma'lumot topilmadi")}</td></tr>
                ) : (
                  <>
                    {grouped.map((row, idx) => (
                      <tr key={row.key}>
                        <td className="text-center text-slate-500">{idx + 1}</td>
                        <td className="font-medium">{row.label}</td>
                        {groupBy === "product" && <td className="text-slate-500">{row.category}</td>}
                        {groupBy === "product" && <td className="text-center">{row.unit}</td>}
                        <td className="text-center">{row.count}</td>
                        <td className="text-center font-medium">{Math.round(row.quantity)}</td>
                        <td className="text-right font-semibold">{formatUzs(row.totalUzs)}</td>
                        <td className="text-right text-blue-600">{row.totalUsd > 0 ? formatUsd(row.totalUsd) : ""}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
              {grouped.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={groupBy === "product" ? 4 : 2} className="text-right">{t("Jami")}:</td>
                    <td className="text-center">{filtered.length}</td>
                    <td className="text-center">{Math.round(totals.qty)}</td>
                    <td className="text-right">{formatUzs(totals.uzs)}</td>
                    <td className="text-right text-blue-700">{totals.usd > 0 ? formatUsd(totals.usd) : ""}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            /* Detailed table (no grouping) */
            <table className="report-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">#</th>
                  <th>{t("Sana")}</th>
                  <th>{t("Mijoz")}</th>
                  <th>{t("Mahsulot nomi")}</th>
                  <th>{t("Guruh")}</th>
                  <th className="text-center">{t("O'lchov")}</th>
                  <th className="text-center">{t("Miqdor")}</th>
                  <th className="text-right">{t("Narx (UZS)")}</th>
                  <th className="text-right">{t("Jami (UZS)")}</th>
                  <th className="text-right">{t("Jami ($)")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} className="text-center py-8 text-slate-400">{t("Yuklanmoqda...")}</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-slate-400">{t("Ma'lumot topilmadi")}</td></tr>
                ) : (
                  <>
                    {filtered.map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-center text-slate-500">{idx + 1}</td>
                        <td className="whitespace-nowrap">{new Date(item.saleDate).toLocaleDateString("uz")}</td>
                        <td>{item.customerName ?? <span className="text-slate-400">{t("Oddiy mijoz")}</span>}</td>
                        <td className="font-medium">{item.productName} <span className="text-xs text-slate-400 font-mono">({item.productCode})</span></td>
                        <td className="text-slate-500">{item.categoryName}</td>
                        <td className="text-center">{item.unit}</td>
                        <td className="text-center font-medium">{item.quantity}</td>
                        <td className="text-right">{formatUzs(item.unitPriceUzs)}</td>
                        <td className="text-right font-semibold">{formatUzs(item.totalUzs)}</td>
                        <td className="text-right text-blue-600">{item.totalUsd > 0 ? formatUsd(item.totalUsd) : ""}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={6} className="text-right">{t("Jami")}:</td>
                    <td className="text-center">{Math.round(totals.qty)}</td>
                    <td></td>
                    <td className="text-right">{formatUzs(totals.uzs)}</td>
                    <td className="text-right text-blue-700">{totals.usd > 0 ? formatUsd(totals.usd) : ""}</td>
                  </tr>
                </tfoot>
              )}
            </table>
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
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${className}`}>{value}</span>
    </div>
  );
}
