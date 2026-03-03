import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Wallet, Download, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input, Select, Tabs, Badge, SearchInput } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { formatUzs, formatUsd } from "@ezoz/shared";
import { exportToExcel } from "@/lib/exportExcel";

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

  const productSalesReport = useQuery({
    queryKey: ["report", "productSales", dateFrom, dateTo],
    queryFn: () => trpc.report.productSalesReport.query({ dateFrom, dateTo }),
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
                      { header: t("Ombor"), key: "warehouse", width: 15 },
                      { header: t("Qoldiq"), key: "qty", width: 10 },
                      { header: t("Sotish narxi (UZS)"), key: "price", width: 18 },
                      { header: t("Tan narxi (UZS)"), key: "cost", width: 18 },
                      { header: t("Jami qiymat (UZS)"), key: "total", width: 18 },
                    ],
                    data: d.items.map((item, idx) => ({
                      idx: idx + 1,
                      name: item.productName,
                      category: item.category,
                      warehouse: item.warehouse,
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
                        <td className="text-sm text-slate-500 hidden md:table-cell">{item.warehouse}</td>
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

function ProductSalesTab({
  data,
  isLoading,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
}: {
  data: ProductSaleItem[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (d: string) => void;
  setDateTo: (d: string) => void;
}) {
  const t = useT();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      item.productName.toLowerCase().includes(q) ||
      item.productCode.toLowerCase().includes(q) ||
      item.documentNo.toLowerCase().includes(q) ||
      (item.customerName && item.customerName.toLowerCase().includes(q))
    );
  }, [data, search]);

  const totals = useMemo(() => filtered.reduce(
    (acc, item) => ({
      qty: acc.qty + item.quantity,
      uzs: acc.uzs + item.totalUzs,
      usd: acc.usd + item.totalUsd,
    }),
    { qty: 0, uzs: 0, usd: 0 },
  ), [filtered]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
        <Input label={t("Dan")} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input label={t("Gacha")} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <div className="flex-1">
          <SearchInput
            placeholder={t("Mahsulot, mijoz, hujjat qidirish...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
        <button
          className="flex items-center gap-1.5 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-2 rounded-lg transition-colors shrink-0"
          onClick={() => {
            exportToExcel({
              filename: `mahsulot-sotuvlar_${dateFrom}_${dateTo}`,
              sheetName: t("Mahsulotlar hisoboti"),
              columns: [
                { header: "#", key: "idx", width: 5 },
                { header: t("Sana"), key: "date", width: 18 },
                { header: t("Hujjat"), key: "doc", width: 12 },
                { header: t("Mijoz"), key: "customer", width: 20 },
                { header: t("Kassir"), key: "cashier", width: 15 },
                { header: t("Mahsulot"), key: "product", width: 25 },
                { header: t("Kod"), key: "code", width: 10 },
                { header: t("Guruh"), key: "category", width: 15 },
                { header: t("Miqdor"), key: "qty", width: 10 },
                { header: t("Narx (UZS)"), key: "price", width: 18 },
                { header: t("Jami (UZS)"), key: "total", width: 18 },
              ],
              data: filtered.map((item, idx) => ({
                idx: idx + 1,
                date: new Date(item.saleDate).toLocaleDateString("uz"),
                doc: item.documentNo,
                customer: item.customerName ?? t("Oddiy mijoz"),
                cashier: item.cashierName,
                product: item.productName,
                code: item.productCode,
                category: item.categoryName,
                qty: item.quantity,
                price: item.unitPriceUzs,
                total: item.totalUzs,
              })),
            });
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
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>{t("Sana")}</th>
                <th>{t("Hujjat")}</th>
                <th className="hidden md:table-cell">{t("Mijoz")}</th>
                <th>{t("Mahsulot")}</th>
                <th className="hidden sm:table-cell">{t("Guruh")}</th>
                <th className="text-center">{t("Miqdor")}</th>
                <th className="text-right">{t("Narx")}</th>
                <th className="text-right">{t("Jami")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">{t("Yuklanmoqda...")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">{t("Ma'lumot topilmadi")}</td></tr>
              ) : (
                <>
                  {filtered.map((item, idx) => (
                    <tr key={idx}>
                      <td className="text-xs text-slate-400 text-center">{idx + 1}</td>
                      <td className="text-sm whitespace-nowrap">{new Date(item.saleDate).toLocaleDateString("uz")}</td>
                      <td className="font-mono text-xs">{item.documentNo}</td>
                      <td className="text-sm hidden md:table-cell">{item.customerName ?? <span className="text-slate-400">{t("Oddiy mijoz")}</span>}</td>
                      <td>
                        <div className="min-w-0">
                          <span className="font-medium text-slate-900 text-[13px]">{item.productName}</span>
                          <span className="block text-[11px] text-slate-400 font-mono">{item.productCode}</span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell"><Badge variant="neutral">{item.categoryName}</Badge></td>
                      <td className="text-center font-medium">{item.quantity} <span className="text-xs text-slate-400">{item.unit.toLowerCase()}</span></td>
                      <td className="text-right text-sm">{formatUzs(item.unitPriceUzs)}</td>
                      <td className="text-right font-medium">{formatUzs(item.totalUzs)}</td>
                    </tr>
                  ))}
                  {/* Summary row */}
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                    <td colSpan={6} className="text-right text-sm text-slate-600">{t("Jami")}:</td>
                    <td className="text-center">{Math.round(totals.qty)}</td>
                    <td></td>
                    <td className="text-right text-slate-900">{formatUzs(totals.uzs)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
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
