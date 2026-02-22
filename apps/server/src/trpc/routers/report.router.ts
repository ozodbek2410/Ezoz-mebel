import { z } from "zod";
import { router, protectedProcedure, bossProcedure } from "../trpc";

const dateRangeInput = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  cashRegister: z.enum(["SALES", "SERVICE"]).optional(),
});

export const reportRouter = router({
  dashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todaySales, todayIncome, todayExpenses, activeCustomers, recentSales, lowStock] =
      await Promise.all([
        // Today's sales count
        ctx.db.sale.count({
          where: {
            createdAt: { gte: todayStart, lte: todayEnd },
            status: { not: "CANCELLED" },
          },
        }),
        // Today's income
        ctx.db.payment.aggregate({
          where: { createdAt: { gte: todayStart, lte: todayEnd } },
          _sum: { amountUzs: true, amountUsd: true },
        }),
        // Today's expenses
        ctx.db.expense.aggregate({
          where: { createdAt: { gte: todayStart, lte: todayEnd } },
          _sum: { amountUzs: true },
        }),
        // Active customers count
        ctx.db.customer.count({ where: { isActive: true } }),
        // Recent 10 sales
        ctx.db.sale.findMany({
          where: { status: { not: "CANCELLED" } },
          include: {
            customer: { select: { fullName: true } },
            cashier: { select: { fullName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        // Low stock items
        ctx.db.stockItem.findMany({
          where: {
            product: { isActive: true },
          },
          include: {
            product: { select: { name: true, minStockAlert: true, unit: true } },
            warehouse: { select: { name: true } },
          },
        }),
      ]);

    // Filter low stock in JS (Prisma can't compare two columns directly)
    const lowStockItems = lowStock
      .filter((s) => Number(s.quantity) <= Number(s.product.minStockAlert) && Number(s.product.minStockAlert) > 0)
      .slice(0, 10);

    return {
      todaySalesCount: todaySales,
      todayIncomeUzs: Number(todayIncome._sum.amountUzs ?? 0),
      todayIncomeUsd: Number(todayIncome._sum.amountUsd ?? 0),
      todayExpensesUzs: Number(todayExpenses._sum.amountUzs ?? 0),
      activeCustomers,
      recentSales: recentSales.map((s) => ({
        id: s.id,
        documentNo: s.documentNo,
        saleType: s.saleType,
        status: s.status,
        totalUzs: Number(s.totalUzs),
        totalUsd: Number(s.totalUsd),
        customerName: s.customer?.fullName ?? null,
        cashierName: s.cashier.fullName,
        createdAt: s.createdAt,
      })),
      lowStockItems: lowStockItems.map((s) => ({
        productName: s.product.name,
        warehouseName: s.warehouse.name,
        quantity: Number(s.quantity),
        minAlert: Number(s.product.minStockAlert),
        unit: s.product.unit,
      })),
    };
  }),

  // Sales chart data (last N days)
  salesChart: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const data: Array<{ date: string; salesUzs: number; expensesUzs: number; count: number }> = [];

      for (let i = input.days - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);

        const [sales, expenses] = await Promise.all([
          ctx.db.sale.aggregate({
            where: { createdAt: { gte: d, lte: dayEnd }, status: { not: "CANCELLED" } },
            _sum: { totalUzs: true },
            _count: true,
          }),
          ctx.db.expense.aggregate({
            where: { createdAt: { gte: d, lte: dayEnd } },
            _sum: { amountUzs: true },
          }),
        ]);

        data.push({
          date: d.toISOString().split("T")[0]!,
          salesUzs: Number(sales._sum.totalUzs ?? 0),
          expensesUzs: Number(expenses._sum.amountUzs ?? 0),
          count: sales._count,
        });
      }
      return data;
    }),

  // Top products by revenue
  topProducts: protectedProcedure
    .input(z.object({
      dateFrom: z.string(),
      dateTo: z.string(),
      limit: z.number().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo + "T23:59:59");

      const items = await ctx.db.saleItem.groupBy({
        by: ["productId"],
        where: {
          sale: { createdAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" } },
          productId: { not: null },
        },
        _sum: { totalUzs: true, quantity: true },
        orderBy: { _sum: { totalUzs: "desc" } },
        take: input.limit,
      });

      const productIds = items.map((i) => i.productId!).filter(Boolean);
      const products = await ctx.db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p.name]));

      return items.map((i) => ({
        productId: i.productId!,
        productName: productMap.get(i.productId!) ?? "Noma'lum",
        totalUzs: Number(i._sum.totalUzs ?? 0),
        totalQty: Number(i._sum.quantity ?? 0),
      }));
    }),

  dailyCashier: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo + "T23:59:59");
      const registerFilter = input.cashRegister ? { cashRegister: input.cashRegister as "SALES" | "SERVICE" } : {};

      const [sales, payments, expenses] = await Promise.all([
        ctx.db.sale.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" }, ...registerFilter.cashRegister ? { saleType: registerFilter.cashRegister === "SALES" ? "PRODUCT" : "SERVICE" } : {} },
          _sum: { totalUzs: true, totalUsd: true },
          _count: true,
        }),
        ctx.db.payment.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, ...registerFilter },
          _sum: { amountUzs: true, amountUsd: true },
        }),
        ctx.db.expense.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, ...registerFilter },
          _sum: { amountUzs: true, amountUsd: true },
        }),
      ]);

      return {
        totalSalesUzs: Number(sales._sum.totalUzs ?? 0),
        totalSalesUsd: Number(sales._sum.totalUsd ?? 0),
        salesCount: sales._count,
        totalPaymentsUzs: Number(payments._sum.amountUzs ?? 0),
        totalPaymentsUsd: Number(payments._sum.amountUsd ?? 0),
        totalExpensesUzs: Number(expenses._sum.amountUzs ?? 0),
        totalExpensesUsd: Number(expenses._sum.amountUsd ?? 0),
        netUzs: Number(payments._sum.amountUzs ?? 0) - Number(expenses._sum.amountUzs ?? 0),
        netUsd: Number(payments._sum.amountUsd ?? 0) - Number(expenses._sum.amountUsd ?? 0),
      };
    }),

  bossOverview: bossProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo + "T23:59:59");

      const [salesCash, serviceCash, salesExpenses, serviceExpenses, advances] = await Promise.all([
        ctx.db.payment.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, cashRegister: "SALES" },
          _sum: { amountUzs: true, amountUsd: true },
        }),
        ctx.db.payment.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, cashRegister: "SERVICE" },
          _sum: { amountUzs: true, amountUsd: true },
        }),
        ctx.db.expense.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, cashRegister: "SALES" },
          _sum: { amountUzs: true },
        }),
        ctx.db.expense.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, cashRegister: "SERVICE" },
          _sum: { amountUzs: true },
        }),
        ctx.db.advance.aggregate({
          where: { givenAt: { gte: dateFrom, lte: dateTo } },
          _sum: { amountUzs: true },
        }),
      ]);

      const totalIncomeUzs = Number(salesCash._sum.amountUzs ?? 0) + Number(serviceCash._sum.amountUzs ?? 0);
      const totalExpensesUzs = Number(salesExpenses._sum.amountUzs ?? 0) + Number(serviceExpenses._sum.amountUzs ?? 0);
      const totalAdvancesUzs = Number(advances._sum.amountUzs ?? 0);

      return {
        salesCashUzs: Number(salesCash._sum.amountUzs ?? 0),
        salesCashUsd: Number(salesCash._sum.amountUsd ?? 0),
        serviceCashUzs: Number(serviceCash._sum.amountUzs ?? 0),
        serviceCashUsd: Number(serviceCash._sum.amountUsd ?? 0),
        salesExpensesUzs: Number(salesExpenses._sum.amountUzs ?? 0),
        serviceExpensesUzs: Number(serviceExpenses._sum.amountUzs ?? 0),
        totalAdvancesUzs,
        totalIncomeUzs,
        totalExpensesUzs,
        netProfitUzs: totalIncomeUzs - totalExpensesUzs - totalAdvancesUzs,
      };
    }),

  inventoryReport: protectedProcedure
    .input(z.object({ warehouseId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const stockItems = await ctx.db.stockItem.findMany({
        where: input?.warehouseId ? { warehouseId: input.warehouseId } : {},
        include: {
          product: { include: { category: true } },
          warehouse: true,
        },
        orderBy: { product: { category: { name: "asc" } } },
      });

      let totalValueUzs = 0;
      let totalValueUsd = 0;
      let totalCostUzs = 0;
      let totalCostUsd = 0;

      const items = stockItems.map((s) => {
        const qty = Number(s.quantity);
        const priceUzs = Number(s.product.sellPriceUzs);
        const priceUsd = Number(s.product.sellPriceUsd);
        const costUzs = Number(s.product.costPriceUzs);
        const costUsd = Number(s.product.costPriceUsd);

        totalValueUzs += qty * priceUzs;
        totalValueUsd += qty * priceUsd;
        totalCostUzs += qty * costUzs;
        totalCostUsd += qty * costUsd;

        return {
          productId: s.productId,
          productName: s.product.name,
          category: s.product.category.name,
          warehouse: s.warehouse.name,
          unit: s.product.unit,
          quantity: qty,
          priceUzs,
          priceUsd,
          costUzs,
          costUsd,
          totalPriceUzs: qty * priceUzs,
          totalCostUzs: qty * costUzs,
        };
      });

      return { items, totalValueUzs, totalValueUsd, totalCostUzs, totalCostUsd };
    }),
});
