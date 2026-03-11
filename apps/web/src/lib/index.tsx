import { useState, useEffect, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useNavigate } from "@tanstack/react-router";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Wallet, Download, Package, ArrowLeft, Wrench, CheckCircle, Star } from "lucide-react";
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
  const { isBoss, isMaster } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string>;
  const defaultTab = isBoss() ? "boss" : isMaster() ? "my" : "cashier";
  const [activeTab, setActiveTab] = useState(search?.tab ?? defaultTab);
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

  const myReport = useQuery({
    queryKey: ["report", "my", dateFrom, dateTo],
    queryFn: () => trpc.report.myReport.query({ dateFrom, dateTo }),
    enabled: activeTab === "my",
  });

  const bossReport = useQuery({
    queryKey: ["report", "boss", dateFrom, dateTo],
    queryFn: () => trpc.report.bossOverview.query({ dateFrom, dateTo }),
    enabled: activeTab === "boss" && isBoss(),
  });

  const inventoryReport = useQuery({
    queryKey: ["report", "inventory"],
    queryFn: () => trpc.report.inventoryReport.query(),
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
              { id: "my", label: t("O'z hisobotim") },
              ...(!isMaster() ? [{ id: "cashier", label: t("Kassir hisoboti") }] : []),
              ...(!isMaster() ? [{ id: "products", label: t("Mahsulotlar") }] : []),
              ...(!isMaster() ? [{ id: "charts", label: t("Diagrammalar") }] : []),
              ...(!isMaster() ? [{ id: "inventory", label: t("Inventar") }] : []),
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

        {/* My Report Tab */}
        {activeTab === "my" && myReport.data && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label={t("Bajarilgan vazifalar")}
                value={String(myReport.data.workshopTasksCount)}
                icon={<CheckCircle className="w-5 h-5 text-green-600" />}
                variant="success"
              />
              <StatCard
                label={t("Har bir vazifa bonusi")}
                value={formatUzs(myReport.data.bonusPerJob)}
                icon={<Wrench className="w-5 h-5 text-orange-500" />}
              />
              <StatCard
                label={t("Jami bonus")}
                value={formatUzs(myReport.data.totalBonusUzs)}
                icon={<Star className="w-5 h-5 text-amber-500" />}
              />
            </div>

            {myReport.data.workshopTasks.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Wrench size={16} className="text-orange-500" />
                    {t("Bajarilgan ustaxona vazifalari")}
                  </h3>
                  <span className="text-xs text-slate-400">{myReport.data.workshopTasksCount} {t("ta vazifa")}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {myReport.data.workshopTasks.map((task, index) => (
                    <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-orange-600">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{task.description}</p>
                        {task.customerName && (
                          <p className="text-xs text-slate-400 mt-0.5">{task.customerName}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs font-semibold text-amber-600">{formatUzs(myReport.data.bonusPerJob)}</span>
                        <span className="text-xs text-slate-400">
                          {task.completedAt ? new Date(task.completedAt).toLocaleDateString("uz-UZ") : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {myReport.data.bonusPerJob > 0 && (
                  <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
                    <span className="text-sm text-amber-700">{t("Vazifalardan jami bonus")}</span>
                    <span className="text-sm font-bold text-amber-700">
                      {formatUzs(myReport.data.workshopTasksCount * myReport.data.bonusPerJob)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {myReport.data.jobRecords.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Star size={16} className="text-amber-500" />
                    {t("Qo'shimcha bonus yozuvlari")}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {myReport.data.jobRecords.map((jr) => (
                    <div key={jr.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{jr.description}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(jr.date).toLocaleDateString("uz-UZ")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-amber-600">{formatUzs(jr.bonusUzs)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myReport.data.workshopTasks.length === 0 && myReport.data.jobRecords.length === 0 && (
              <div className="empty-state">
                <Wrench className="empty-state-icon" />
                <p className="empty-state-title">{t("Bu davrda ma'lumot yo'q")}</p>
              </div>
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
          <BossOverviewTab data={bossReport.data} dateFrom={dateFrom} dateTo={dateTo} />
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
                    {inventoryReport.data.items.map((item) => (
                      <tr key={item.productId}>
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

// ===== Boss Overview Tab =====
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_UZS: "Naqd (UZS)",
  CASH_USD: "Naqd (USD)",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
  DEBT: "Nasiya",
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH_UZS: "text-green-600",
  CASH_USD: "text-emerald-600",
  CARD: "text-blue-600",
  TRANSFER: "text-indigo-600",
  DEBT: "text-red-500",
};

interface BossData {
  salesCashUzs: number;
  salesCashUsd: number;
  serviceCashUzs: number;
  serviceCashUsd: number;
  salesExpensesUzs: number;
  serviceExpensesUzs: number;
  totalAdvancesUzs: number;
  totalIncomeUzs: number;
  totalExpensesUzs: number;
  salaryPaidUzs: number;
  netProfitUzs: number;
  salesCount: number;
  serviceCount: number;
  totalSalesCount: number;
  paymentMethods: Record<string, { uzs: number; usd: number; count: number }>;
  customerTotalDebtUzs: number;
  newCustomers: number;
  workshopPending: number;
  workshopInProgress: number;
  workshopCompleted: number;
  topCashiers: Array<{ fullName: string; totalUzs: number; count: number }>;
}

function BossOverviewTab({ data: d, dateFrom, dateTo }: { data: BossData; dateFrom: string; dateTo: string }) {
  const t = useT();

  const handleExcel = () => {
    const sec = (label: string): Record<string, unknown> => ({
      _section: true, label, uzs: "", usd: "", extra: "",
    });
    const tot = (label: string, uzs: number): Record<string, unknown> => ({
      _total: true, label, uzs, usd: "", extra: "",
    });

    const paymentRows = Object.entries(d.paymentMethods)
      .sort((a, b) => b[1].uzs - a[1].uzs)
      .map(([method, val]) => ({
        label: `  ${PAYMENT_METHOD_LABELS[method] ?? method}`,
        uzs: val.uzs,
        usd: val.usd > 0 ? val.usd : "",
        extra: `${val.count} ta`,
      }));

    const cashierRows = d.topCashiers.map((c, i) => ({
      label: `  ${i + 1}. ${c.fullName}`,
      uzs: c.totalUzs,
      usd: "",
      extra: `${c.count} ta`,
    }));

    const totalChiqim = d.totalExpensesUzs + d.salaryPaidUzs + d.totalAdvancesUzs;

    exportToExcel({
      filename: `umumiy-hisobot_${dateFrom}_${dateTo}`,
      sheetName: "Umumiy hisobot",
      title: `Umumiy hisobot: ${dateFrom} dan ${dateTo} gacha`,
      columns: [
        { header: "Ko'rsatkich", key: "label", width: 36 },
        { header: "UZS (so'm)", key: "uzs", width: 22 },
        { header: "USD ($)", key: "usd", width: 14 },
        { header: "Son / Izoh", key: "extra", width: 16 },
      ],
      data: [
        // Kassa tushumi
        sec("KASSA TUSHUMI"),
        { label: "  Savdo kassasi tushum", uzs: d.salesCashUzs, usd: d.salesCashUsd || "", extra: "" },
        { label: "  Savdo kassasi xarajat", uzs: d.salesExpensesUzs, usd: "", extra: "" },
        { label: "  Xizmat kassasi tushum", uzs: d.serviceCashUzs, usd: d.serviceCashUsd || "", extra: "" },
        { label: "  Xizmat kassasi xarajat", uzs: d.serviceExpensesUzs, usd: "", extra: "" },
        tot("Jami tushum", d.totalIncomeUzs),

        // Sotuvlar statistikasi
        sec("SOTUVLAR STATISTIKASI"),
        { label: "  Jami sotuvlar soni", uzs: "", usd: "", extra: `${d.totalSalesCount} ta` },
        { label: "  Mahsulot savdo", uzs: "", usd: "", extra: `${d.salesCount} ta` },
        { label: "  Xizmat savdo", uzs: "", usd: "", extra: `${d.serviceCount} ta` },
        { label: "  Yangi mijozlar (davr ichida)", uzs: "", usd: "", extra: `${d.newCustomers} ta` },
        { label: "  Umumiy mijoz qarzi", uzs: d.customerTotalDebtUzs, usd: "", extra: "" },

        // To'lov usullari
        sec("TO'LOV USULLARI"),
        ...paymentRows,

        // Ustaxona holati
        sec("USTAXONA HOLATI"),
        { label: "  Kutmoqda", uzs: "", usd: "", extra: `${d.workshopPending} ta` },
        { label: "  Jarayonda", uzs: "", usd: "", extra: `${d.workshopInProgress} ta` },
        { label: "  Yakunlangan", uzs: "", usd: "", extra: `${d.workshopCompleted} ta` },

        // Top kassirlar
        ...(d.topCashiers.length > 0
          ? [sec("TOP KASSIRLAR (tushum bo'yicha)"), ...cashierRows]
          : []),

        // Chiqimlar
        sec("CHIQIMLAR TAFSILOTI"),
        { label: "  Savdo kassasi xarajat", uzs: d.salesExpensesUzs, usd: "", extra: "" },
        { label: "  Xizmat kassasi xarajat", uzs: d.serviceExpensesUzs, usd: "", extra: "" },
        { label: "  Maosh to'lovlar", uzs: d.salaryPaidUzs, usd: "", extra: "" },
        { label: "  Berilgan avanslar", uzs: d.totalAdvancesUzs, usd: "", extra: "" },
        tot("Jami chiqim", totalChiqim),

        // Yakuniy hisob
        sec("YAKUNIY HISOB"),
        { label: "  Jami tushum", uzs: d.totalIncomeUzs, usd: "", extra: "" },
        { label: "  Jami chiqim", uzs: totalChiqim, usd: "", extra: "" },
        tot(d.netProfitUzs >= 0 ? "SOF FOYDA" : "ZARAR", d.netProfitUzs),
      ],
    });
  };

  const maxCashier = d.topCashiers[0]?.totalUzs ?? 1;

  return (
    <div className="space-y-6">
      {/* Excel */}
      <div className="flex justify-end">
        <button
          className="btn-sm flex items-center gap-1.5 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
          onClick={handleExcel}
        >
          <Download size={14} />
          Excel
        </button>
      </div>

      {/* Hero: Sof foyda */}
      <div className={`rounded-2xl p-6 ${d.netProfitUzs >= 0 ? "bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200" : "bg-gradient-to-br from-red-50 to-rose-100 border border-red-200"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{t("Sof foyda (davr)")}</p>
            <p className={`text-3xl font-bold ${d.netProfitUzs >= 0 ? "text-green-700" : "text-red-700"}`}>
              {formatUzs(d.netProfitUzs)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{t("Tushum - Xarajat - Maosh - Avans")}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/70 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-slate-400">{t("Jami tushum")}</p>
              <p className="text-sm font-bold text-green-700 mt-0.5">{formatUzs(d.totalIncomeUzs)}</p>
            </div>
            <div className="bg-white/70 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-slate-400">{t("Xarajatlar")}</p>
              <p className="text-sm font-bold text-red-600 mt-0.5">{formatUzs(d.totalExpensesUzs)}</p>
            </div>
            <div className="bg-white/70 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-slate-400">{t("Maosh")}</p>
              <p className="text-sm font-bold text-amber-600 mt-0.5">{formatUzs(d.salaryPaidUzs)}</p>
            </div>
            <div className="bg-white/70 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-slate-400">{t("Avanslar")}</p>
              <p className="text-sm font-bold text-orange-600 mt-0.5">{formatUzs(d.totalAdvancesUzs)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Kassalar + Sotuvlar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kassa tafsiloti */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Wallet size={16} className="text-indigo-500" />
              {t("Kassa tushumi")}
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {/* Savdo */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{t("Savdo kassasi")}</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-700">{formatUzs(d.salesCashUzs)}</p>
                  {d.salesCashUsd > 0 && <p className="text-xs text-blue-500">{formatUsd(d.salesCashUsd)}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{t("Xarajat")}: <span className="text-red-500 font-medium">{formatUzs(d.salesExpensesUzs)}</span></span>
                <span>{t("Sof")}: <span className="text-green-600 font-medium">{formatUzs(d.salesCashUzs - d.salesExpensesUzs)}</span></span>
              </div>
            </div>
            {/* Xizmat */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{t("Xizmat kassasi")}</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-cyan-700">{formatUzs(d.serviceCashUzs)}</p>
                  {d.serviceCashUsd > 0 && <p className="text-xs text-blue-500">{formatUsd(d.serviceCashUsd)}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{t("Xarajat")}: <span className="text-red-500 font-medium">{formatUzs(d.serviceExpensesUzs)}</span></span>
                <span>{t("Sof")}: <span className="text-green-600 font-medium">{formatUzs(d.serviceCashUzs - d.serviceExpensesUzs)}</span></span>
              </div>
            </div>
            {/* Jami */}
            <div className="px-5 py-3 bg-slate-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">{t("Jami tushum")}</span>
              <span className="text-base font-bold text-green-700">{formatUzs(d.totalIncomeUzs)}</span>
            </div>
          </div>
        </div>

        {/* Sotuvlar statistikasi */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShoppingBag size={16} className="text-indigo-500" />
              {t("Sotuvlar statistikasi")}
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">{t("Jami sotuvlar soni")}</span>
              <span className="text-xl font-bold text-slate-900">{d.totalSalesCount}</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-indigo-500 rounded-full transition-all"
                    style={{ width: d.totalSalesCount > 0 ? `${(d.salesCount / d.totalSalesCount) * 100}%` : "0%" }}
                  />
                </div>
                <div className="w-36 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t("Mahsulot savdo")}</span>
                  <span className="font-semibold text-indigo-700">{d.salesCount}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-cyan-500 rounded-full transition-all"
                    style={{ width: d.totalSalesCount > 0 ? `${(d.serviceCount / d.totalSalesCount) * 100}%` : "0%" }}
                  />
                </div>
                <div className="w-36 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t("Xizmat savdo")}</span>
                  <span className="font-semibold text-cyan-700">{d.serviceCount}</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400">{t("Yangi mijozlar")}</p>
                <p className="text-lg font-bold text-amber-700 mt-0.5">{d.newCustomers}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400">{t("Umumiy qarz")}</p>
                <p className="text-sm font-bold text-red-600 mt-0.5">{formatUzs(d.customerTotalDebtUzs)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: To'lov usullari + Ustaxona */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* To'lov usullari */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign size={16} className="text-green-500" />
              {t("To'lov usullari")}
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {Object.entries(d.paymentMethods).length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">{t("Bu davrda to'lov yo'q")}</p>
            ) : (
              Object.entries(d.paymentMethods)
                .sort((a, b) => b[1].uzs - a[1].uzs)
                .map(([method, val]) => {
                  const totalUzs = Object.values(d.paymentMethods).reduce((s, v) => s + v.uzs, 0);
                  const pct = totalUzs > 0 ? Math.round((val.uzs / totalUzs) * 100) : 0;
                  return (
                    <div key={method} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-medium ${PAYMENT_METHOD_COLORS[method] ?? "text-slate-600"}`}>
                            {PAYMENT_METHOD_LABELS[method] ?? method}
                          </span>
                          <span className="text-xs text-slate-400">{val.count} {t("ta")} · {pct}%</span>
                        </div>
                        <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="h-1.5 bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-sm font-semibold text-slate-800">{formatUzs(val.uzs)}</p>
                        {val.usd > 0 && <p className="text-xs text-blue-500">{formatUsd(val.usd)}</p>}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Ustaxona holati */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Wrench size={16} className="text-orange-500" />
              {t("Ustaxona holati")}
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">{t("Kutmoqda")}</p>
                <p className="text-2xl font-bold text-slate-500">{d.workshopPending}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
                <p className="text-xs text-blue-400 mb-1">{t("Jarayonda")}</p>
                <p className="text-2xl font-bold text-blue-700">{d.workshopInProgress}</p>
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
                <p className="text-xs text-green-500 mb-1">{t("Yakunlangan")}</p>
                <p className="text-2xl font-bold text-green-700">{d.workshopCompleted}</p>
              </div>
            </div>
            {d.workshopInProgress > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-xs text-blue-700 text-center">
                {d.workshopInProgress} {t("ta buyurtma hozir ustaxonada bajarilmoqda")}
              </div>
            )}
          </div>

          {/* Top kassirlar */}
          {d.topCashiers.length > 0 && (
            <>
              <div className="px-5 pb-1 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t("Top kassirlar (tushum)")}</p>
              </div>
              <div className="divide-y divide-slate-50">
                {d.topCashiers.map((c, i) => (
                  <div key={i} className="px-5 py-2 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-indigo-600">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-slate-700 truncate">{c.fullName}</span>
                        <span className="text-xs font-semibold text-indigo-700">{formatUzs(c.totalUzs)}</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-1 overflow-hidden">
                        <div className="h-1 bg-indigo-400 rounded-full" style={{ width: `${Math.round((c.totalUzs / maxCashier) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 3: Xarajatlar breakdown */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <TrendingDown size={16} className="text-red-500" />
            {t("Chiqimlar tafsiloti")}
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
          {[
            { label: t("Savdo xarajat"), value: d.salesExpensesUzs, color: "text-red-600" },
            { label: t("Xizmat xarajat"), value: d.serviceExpensesUzs, color: "text-red-600" },
            { label: t("Maosh to'lovlar"), value: d.salaryPaidUzs, color: "text-amber-600" },
            { label: t("Berilgan avanslar"), value: d.totalAdvancesUzs, color: "text-orange-500" },
          ].map((item, i) => (
            <div key={i} className="px-5 py-4 text-center">
              <p className="text-xs text-slate-400 mb-1">{item.label}</p>
              <p className={`text-sm font-bold ${item.color}`}>{formatUzs(item.value)}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-red-700">{t("Jami chiqim")}</span>
          <span className="text-sm font-bold text-red-700">
            {formatUzs(d.totalExpensesUzs + d.salaryPaidUzs + d.totalAdvancesUzs)}
          </span>
        </div>
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
                      <Fragment key={`cat-${section.category}`}>
                        <tr className="!bg-indigo-100">
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
                      </Fragment>
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
                      <tr key={`${item.documentNo}-${item.productId}-${idx}`}>
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
