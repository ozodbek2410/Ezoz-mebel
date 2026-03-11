import { z } from "zod";
import { Prisma } from "@prisma/client";
import { router, protectedProcedure, bossProcedure } from "../trpc";
import { uzbStartOfDay, uzbEndOfDay, getUzbDateStr } from "../../lib/timezone";

const UZB_TZ = "+05:00";

const dateRangeInput = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  cashRegister: z.enum(["SALES", "SERVICE"]).optional(),
});

export const reportRouter = router({
  dashboardStats: protectedProcedure.query(async ({ ctx }) => {
    // Use Uzbekistan timezone for day boundaries
    const todayStr = getUzbDateStr();
    const todayStart = uzbStartOfDay(todayStr);
    const todayEnd = uzbEndOfDay(todayStr);

    // Week start (Monday) in Uzbekistan time
    const todayLocal = new Date(todayStr + "T12:00:00" + UZB_TZ);
    const dayOfWeek = todayLocal.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStartDate = new Date(todayLocal);
    weekStartDate.setDate(weekStartDate.getDate() - daysToMonday);
    const weekStart = uzbStartOfDay(getUzbDateStr(weekStartDate));

    // Month start in Uzbekistan time
    const monthStart = uzbStartOfDay(todayStr.slice(0, 7) + "-01");

    const [
      todaySales, todayIncome, todayExpenses,
      weekSales, weekIncome,
      monthSales, monthIncome,
      activeCustomers, totalDebtors, recentSales, lowStock,
    ] = await Promise.all([
      // Today
      ctx.db.sale.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: "CANCELLED" } },
      }),
      ctx.db.payment.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { amountUzs: true, amountUsd: true },
      }),
      ctx.db.expense.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { amountUzs: true },
      }),
      // Week
      ctx.db.sale.count({
        where: { createdAt: { gte: weekStart, lte: todayEnd }, status: { not: "CANCELLED" } },
      }),
      ctx.db.payment.aggregate({
        where: { createdAt: { gte: weekStart, lte: todayEnd } },
        _sum: { amountUzs: true },
      }),
      // Month
      ctx.db.sale.count({
        where: { createdAt: { gte: monthStart, lte: todayEnd }, status: { not: "CANCELLED" } },
      }),
      ctx.db.payment.aggregate({
        where: { createdAt: { gte: monthStart, lte: todayEnd } },
        _sum: { amountUzs: true },
      }),
      // Customers
      ctx.db.customer.count({ where: { isActive: true } }),
      // Debtors count (customers with OPEN sales)
      ctx.db.sale.groupBy({
        by: ["customerId"],
        where: { status: "OPEN", customerId: { not: null } },
        _count: true,
      }),
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
        where: { product: { isActive: true } },
        include: {
          product: { select: { name: true, minStockAlert: true, unit: true } },
          warehouse: { select: { name: true } },
        },
      }),
    ]);

    const lowStockItems = lowStock
      .filter((s) => Number(s.quantity) <= Number(s.product.minStockAlert) && Number(s.product.minStockAlert) > 0)
      .slice(0, 10);

    return {
      todaySalesCount: todaySales,
      todayIncomeUzs: Number(todayIncome._sum.amountUzs ?? 0),
      todayIncomeUsd: Number(todayIncome._sum.amountUsd ?? 0),
      todayExpensesUzs: Number(todayExpenses._sum.amountUzs ?? 0),
      weekSalesCount: weekSales,
      weekIncomeUzs: Number(weekIncome._sum.amountUzs ?? 0),
      monthSalesCount: monthSales,
      monthIncomeUzs: Number(monthIncome._sum.amountUzs ?? 0),
      activeCustomers,
      totalDebtors: totalDebtors.length,
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

  // Sales chart data — efficient single-query approach
  salesChart: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      // Compute date range in Uzbekistan timezone
      const todayStr = getUzbDateStr();
      const startD = new Date(todayStr + "T12:00:00" + UZB_TZ);
      startD.setDate(startD.getDate() - input.days + 1);
      const startDateStr = getUzbDateStr(startD);

      const startDate = uzbStartOfDay(startDateStr);
      const endDate = uzbEndOfDay(todayStr);

      // Group by Uzbekistan local date using AT TIME ZONE
      const salesRaw = await ctx.db.$queryRaw<Array<{ date: string; total_uzs: Prisma.Decimal; cnt: bigint }>>`
        SELECT DATE("createdAt" AT TIME ZONE 'Asia/Tashkent') as date, COALESCE(SUM("totalUzs"), 0) as total_uzs, COUNT(*) as cnt
        FROM "Sale"
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate} AND "status" != 'CANCELLED'
        GROUP BY DATE("createdAt" AT TIME ZONE 'Asia/Tashkent')
        ORDER BY date
      `;

      const expensesRaw = await ctx.db.$queryRaw<Array<{ date: string; total_uzs: Prisma.Decimal }>>`
        SELECT DATE("createdAt" AT TIME ZONE 'Asia/Tashkent') as date, COALESCE(SUM("amountUzs"), 0) as total_uzs
        FROM "Expense"
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
        GROUP BY DATE("createdAt" AT TIME ZONE 'Asia/Tashkent')
        ORDER BY date
      `;

      const salesMap = new Map(salesRaw.map((r) => [
        new Date(r.date).toISOString().split("T")[0],
        { uzs: Number(r.total_uzs), count: Number(r.cnt) },
      ]));
      const expensesMap = new Map(expensesRaw.map((r) => [
        new Date(r.date).toISOString().split("T")[0],
        Number(r.total_uzs),
      ]));

      // Build complete date range using Uzbekistan dates
      const data: Array<{ date: string; salesUzs: number; expensesUzs: number; count: number }> = [];
      for (let i = 0; i < input.days; i++) {
        const d = new Date(startD);
        d.setDate(startD.getDate() + i);
        const key = getUzbDateStr(d);
        const sale = salesMap.get(key);
        data.push({
          date: key,
          salesUzs: sale?.uzs ?? 0,
          expensesUzs: expensesMap.get(key) ?? 0,
          count: sale?.count ?? 0,
        });
      }
      return data;
    }),

  topProducts: protectedProcedure
    .input(z.object({
      dateFrom: z.string(),
      dateTo: z.string(),
      limit: z.number().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const dateFrom = uzbStartOfDay(input.dateFrom);
      const dateTo = uzbEndOfDay(input.dateTo);

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
      const dateFrom = uzbStartOfDay(input.dateFrom);
      const dateTo = uzbEndOfDay(input.dateTo);
      const registerFilter = input.cashRegister ? { cashRegister: input.cashRegister as "SALES" | "SERVICE" } : {};
      const isBoss = ctx.user.role === "BOSS";
      const userFilter = isBoss ? {} : { cashierId: ctx.user.userId };
      const expenseUserFilter = isBoss ? {} : { userId: ctx.user.userId };

      const [sales, payments, expenses] = await Promise.all([
        ctx.db.sale.aggregate({
          where: {
            createdAt: { gte: dateFrom, lte: dateTo },
            status: { not: "CANCELLED" },
            ...userFilter,
            ...(registerFilter.cashRegister ? { saleType: registerFilter.cashRegister === "SALES" ? "PRODUCT" : "SERVICE" } : {}),
          },
          _sum: { totalUzs: true, totalUsd: true },
          _count: true,
        }),
        ctx.db.payment.aggregate({
          where: {
            createdAt: { gte: dateFrom, lte: dateTo },
            ...registerFilter,
            ...(isBoss ? {} : { sale: { cashierId: ctx.user.userId } }),
          },
          _sum: { amountUzs: true, amountUsd: true },
        }),
        ctx.db.expense.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, ...registerFilter, ...expenseUserFilter },
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

  myReport: protectedProcedure
    .input(z.object({ dateFrom: z.string(), dateTo: z.string(), userId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const dateFrom = uzbStartOfDay(input.dateFrom);
      const dateTo = uzbEndOfDay(input.dateTo);
      const userId = (input.userId && ctx.user.role === "BOSS") ? input.userId : ctx.user.userId;

      const [user, jobRecords, workshopTasks] = await Promise.all([
        ctx.db.user.findUnique({ where: { id: userId }, select: { bonusPerJob: true, fullName: true } }),
        ctx.db.jobRecord.findMany({
          where: { userId, date: { gte: dateFrom, lte: dateTo } },
          orderBy: { date: "desc" },
        }),
        ctx.db.workshopTask.findMany({
          where: { assignedToId: userId, status: "COMPLETED", completedAt: { gte: dateFrom, lte: dateTo } },
          include: {
            sale: { select: { customer: { select: { fullName: true } } } },
          },
          orderBy: { completedAt: "desc" },
        }),
      ]);

      const bonusPerJob = Number(user?.bonusPerJob ?? 0);
      const jobRecordsBonus = jobRecords.reduce((sum, jr) => sum + Number(jr.bonusUzs), 0);
      const taskBonus = workshopTasks.length * bonusPerJob;

      return {
        fullName: user?.fullName ?? "",
        bonusPerJob,
        totalBonusUzs: jobRecordsBonus + taskBonus,
        workshopTasksCount: workshopTasks.length,
        jobRecords: jobRecords.map((jr) => ({
          id: jr.id,
          description: jr.description,
          bonusUzs: Number(jr.bonusUzs),
          date: jr.date,
        })),
        workshopTasks: workshopTasks.map((t) => ({
          id: t.id,
          description: t.description,
          stepOrder: t.stepOrder,
          customerName: t.sale.customer?.fullName ?? null,
          completedAt: t.completedAt,
        })),
      };
    }),

  employeeDetail: bossProcedure
    .input(z.object({ dateFrom: z.string(), dateTo: z.string(), userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const dateFrom = uzbStartOfDay(input.dateFrom);
      const dateTo = uzbEndOfDay(input.dateTo);

      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, fullName: true, role: true, bonusPerJob: true, baseSalaryUzs: true },
      });
      if (!user) throw new Error("User not found");

      if (user.role === "MASTER") {
        const [jobRecords, workshopTasks] = await Promise.all([
          ctx.db.jobRecord.findMany({
            where: { userId: user.id, date: { gte: dateFrom, lte: dateTo } },
            orderBy: { date: "desc" },
          }),
          ctx.db.workshopTask.findMany({
            where: { assignedToId: user.id, status: "COMPLETED", completedAt: { gte: dateFrom, lte: dateTo } },
            include: { sale: { select: { customer: { select: { fullName: true } } } } },
            orderBy: { completedAt: "desc" },
          }),
        ]);
        const bonusPerJob = Number(user.bonusPerJob);
        const jobRecordsBonus = jobRecords.reduce((sum, jr) => sum + Number(jr.bonusUzs), 0);
        const taskBonus = workshopTasks.length * bonusPerJob;
        return {
          type: "MASTER" as const,
          fullName: user.fullName,
          role: user.role,
          bonusPerJob,
          baseSalaryUzs: Number(user.baseSalaryUzs),
          totalBonusUzs: jobRecordsBonus + taskBonus,
          workshopTasksCount: workshopTasks.length,
          workshopTasks: workshopTasks.map((t) => ({
            id: t.id,
            description: t.description,
            customerName: t.sale.customer?.fullName ?? null,
            completedAt: t.completedAt,
            bonus: bonusPerJob,
          })),
          jobRecords: jobRecords.map((jr) => ({
            id: jr.id,
            description: jr.description,
            bonusUzs: Number(jr.bonusUzs),
            date: jr.date,
          })),
        };
      }

      // CASHIER_SALES or CASHIER_SERVICE
      const saleType = user.role === "CASHIER_SERVICE" ? "SERVICE" : "PRODUCT";
      const [sales, payments, expenses] = await Promise.all([
        ctx.db.sale.findMany({
          where: { cashierId: user.id, saleType, createdAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" } },
          include: { customer: { select: { fullName: true } } },
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.payment.findMany({
          where: { cashRegister: user.role === "CASHIER_SERVICE" ? "SERVICE" : "SALES", createdAt: { gte: dateFrom, lte: dateTo } },
          include: { sale: { select: { documentNo: true, customer: { select: { fullName: true } } } } },
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.expense.findMany({
          where: { userId: user.id, createdAt: { gte: dateFrom, lte: dateTo } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const totalSalesUzs = sales.reduce((s, sale) => s + Number(sale.totalUzs), 0);
      const totalPaymentsUzs = payments.reduce((s, p) => s + Number(p.amountUzs), 0);
      const totalExpensesUzs = expenses.reduce((s, e) => s + Number(e.amountUzs), 0);

      return {
        type: "CASHIER" as const,
        fullName: user.fullName,
        role: user.role,
        baseSalaryUzs: Number(user.baseSalaryUzs),
        totalSalesUzs,
        totalPaymentsUzs,
        totalExpensesUzs,
        netUzs: totalPaymentsUzs - totalExpensesUzs,
        sales: sales.map((s) => ({
          id: s.id,
          documentNo: s.documentNo,
          customerName: s.customer?.fullName ?? null,
          totalUzs: Number(s.totalUzs),
          status: s.status,
          createdAt: s.createdAt,
        })),
        payments: payments.map((p) => ({
          id: p.id,
          method: p.paymentType,
          amountUzs: Number(p.amountUzs),
          saleDocNo: p.sale?.documentNo ?? null,
          customerName: p.sale?.customer?.fullName ?? null,
          createdAt: p.createdAt,
        })),
        expenses: expenses.map((e) => ({
          id: e.id,
          description: e.description,
          amountUzs: Number(e.amountUzs),
          category: e.categoryId,
          createdAt: e.createdAt,
        })),
      };
    }),

  employeesSummary: bossProcedure
    .input(z.object({ dateFrom: z.string(), dateTo: z.string() }))
    .query(async ({ ctx, input }) => {
      const dateFrom = uzbStartOfDay(input.dateFrom);
      const dateTo = uzbEndOfDay(input.dateTo);

      const [users, salesByUser] = await Promise.all([
        ctx.db.user.findMany({
          where: { isActive: true, role: { not: "BOSS" } },
          select: {
            id: true,
            fullName: true,
            role: true,
            bonusPerJob: true,
            baseSalaryUzs: true,
            jobRecords: {
              where: { date: { gte: dateFrom, lte: dateTo } },
              select: { bonusUzs: true },
            },
            workshopTasks: {
              where: { status: "COMPLETED", completedAt: { gte: dateFrom, lte: dateTo } },
              select: { id: true },
            },
          },
          orderBy: { fullName: "asc" },
        }),
        ctx.db.sale.groupBy({
          by: ["cashierId", "saleType"],
          where: {
            createdAt: { gte: dateFrom, lte: dateTo },
            status: { not: "CANCELLED" },
          },
          _sum: { totalUzs: true },
          _count: { _all: true },
        }),
      ]);

      type SalesEntry = { salesCount: number; salesTotalUzs: number; serviceCount: number; serviceTotalUzs: number };
      const salesMap = new Map<number, SalesEntry>();
      for (const row of salesByUser) {
        if (!row.cashierId) continue;
        if (!salesMap.has(row.cashierId)) {
          salesMap.set(row.cashierId, { salesCount: 0, salesTotalUzs: 0, serviceCount: 0, serviceTotalUzs: 0 });
        }
        const entry = salesMap.get(row.cashierId)!;
        const count = row._count?._all ?? 0;
        const total = Number(row._sum?.totalUzs ?? 0);
        if (row.saleType === "PRODUCT") {
          entry.salesCount = count;
          entry.salesTotalUzs = total;
        } else if (row.saleType === "SERVICE") {
          entry.serviceCount = count;
          entry.serviceTotalUzs = total;
        }
      }

      return users.map((u) => {
        const jobBonus = u.jobRecords.reduce((sum, jr) => sum + Number(jr.bonusUzs), 0);
        const taskBonus = u.workshopTasks.length * Number(u.bonusPerJob);
        const sales = salesMap.get(u.id) ?? { salesCount: 0, salesTotalUzs: 0, serviceCount: 0, serviceTotalUzs: 0 };
        return {
          id: u.id,
          fullName: u.fullName,
          role: u.role,
          bonusPerJob: Number(u.bonusPerJob),
          baseSalaryUzs: Number(u.baseSalaryUzs),
          workshopTasksCount: u.workshopTasks.length,
          jobRecordsCount: u.jobRecords.length,
          totalBonusUzs: jobBonus + taskBonus,
          salesCount: sales.salesCount,
          salesTotalUzs: sales.salesTotalUzs,
          serviceCount: sales.serviceCount,
          serviceTotalUzs: sales.serviceTotalUzs,
        };
      });
    }),

  bossOverview: bossProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const dateFrom = uzbStartOfDay(input.dateFrom);
      const dateTo = uzbEndOfDay(input.dateTo);

      const [
        salesCash, serviceCash,
        salesExpenses, serviceExpenses,
        advances,
        salesCount, serviceCount,
        paymentsByMethod,
        customerDebtRaw,
        workshopPending, workshopInProgress, workshopCompleted,
        topCashiersRaw,
        salaryPaid,
        newCustomers,
        saleItemsForCost,
      ] = await Promise.all([
        // Cash totals
        ctx.db.payment.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, cashRegister: "SALES" },
          _sum: { amountUzs: true, amountUsd: true },
        }),
        ctx.db.payment.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, cashRegister: "SERVICE" },
          _sum: { amountUzs: true, amountUsd: true },
        }),
        // Expenses
        ctx.db.expense.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, cashRegister: "SALES" },
          _sum: { amountUzs: true },
        }),
        ctx.db.expense.aggregate({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, cashRegister: "SERVICE" },
          _sum: { amountUzs: true },
        }),
        // Advances
        ctx.db.advance.aggregate({
          where: { givenAt: { gte: dateFrom, lte: dateTo } },
          _sum: { amountUzs: true },
        }),
        // Sale counts
        ctx.db.sale.count({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, saleType: "PRODUCT", status: { not: "CANCELLED" } },
        }),
        ctx.db.sale.count({
          where: { createdAt: { gte: dateFrom, lte: dateTo }, saleType: "SERVICE", status: { not: "CANCELLED" } },
        }),
        // Payments grouped by paymentType
        ctx.db.payment.groupBy({
          by: ["paymentType"],
          where: { createdAt: { gte: dateFrom, lte: dateTo } },
          _sum: { amountUzs: true, amountUsd: true },
          _count: { id: true },
        }),
        // Customer total initial debt (all customers)
        ctx.db.customer.aggregate({ _sum: { initialDebtUzs: true } }),
        // Workshop task counts
        ctx.db.workshopTask.count({ where: { status: "PENDING" } }),
        ctx.db.workshopTask.count({ where: { status: "IN_PROGRESS" } }),
        ctx.db.workshopTask.count({ where: { status: "COMPLETED", completedAt: { gte: dateFrom, lte: dateTo } } }),
        // Top cashiers by sale total in period
        ctx.db.sale.groupBy({
          by: ["cashierId"],
          where: { createdAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" } },
          _sum: { totalUzs: true },
          _count: { id: true },
          orderBy: { _sum: { totalUzs: "desc" } },
          take: 5,
        }),
        // Salary payments (sum of netPayment)
        ctx.db.salaryPayment.aggregate({
          where: { paidAt: { gte: dateFrom, lte: dateTo } },
          _sum: { netPayment: true },
        }),
        // New customers registered in period
        ctx.db.customer.count({ where: { createdAt: { gte: dateFrom, lte: dateTo } } }),
        // Product cost of goods sold
        ctx.db.saleItem.findMany({
          where: {
            productId: { not: null },
            sale: { createdAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" } },
          },
          select: { quantity: true, product: { select: { costPriceUzs: true } } },
        }),
      ]);

      // Resolve cashier names
      const cashierIds = topCashiersRaw.map((r) => r.cashierId).filter((id): id is number => id !== null);
      const cashierUsers = cashierIds.length > 0
        ? await ctx.db.user.findMany({ where: { id: { in: cashierIds } }, select: { id: true, fullName: true } })
        : [];
      const cashierMap = new Map(cashierUsers.map((u) => [u.id, u.fullName]));

      const topCashiers = topCashiersRaw.map((r) => ({
        fullName: cashierMap.get(r.cashierId) ?? "Noma'lum",
        totalUzs: Number(r._sum.totalUzs ?? 0),
        count: r._count.id ?? 0,
      }));

      // Payment type breakdown
      const methodMap: Record<string, { uzs: number; usd: number; count: number }> = {};
      for (const p of paymentsByMethod) {
        const method = p.paymentType;
        methodMap[method] = {
          uzs: Number(p._sum?.amountUzs ?? 0),
          usd: Number(p._sum?.amountUsd ?? 0),
          count: p._count.id ?? 0,
        };
      }

      const totalIncomeUzs = Number(salesCash._sum.amountUzs ?? 0) + Number(serviceCash._sum.amountUzs ?? 0);
      const totalExpensesUzs = Number(salesExpenses._sum.amountUzs ?? 0) + Number(serviceExpenses._sum.amountUzs ?? 0);
      const totalAdvancesUzs = Number(advances._sum.amountUzs ?? 0);
      const salaryPaidUzs = Number(salaryPaid._sum.netPayment ?? 0);
      const totalProductCostUzs = saleItemsForCost.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.product?.costPriceUzs ?? 0),
        0,
      );

      return {
        // Cash registers
        salesCashUzs: Number(salesCash._sum.amountUzs ?? 0),
        salesCashUsd: Number(salesCash._sum.amountUsd ?? 0),
        serviceCashUzs: Number(serviceCash._sum.amountUzs ?? 0),
        serviceCashUsd: Number(serviceCash._sum.amountUsd ?? 0),
        salesExpensesUzs: Number(salesExpenses._sum.amountUzs ?? 0),
        serviceExpensesUzs: Number(serviceExpenses._sum.amountUzs ?? 0),
        // Totals
        totalAdvancesUzs,
        totalIncomeUzs,
        totalExpensesUzs,
        salaryPaidUzs,
        totalProductCostUzs,
        netProfitUzs: totalIncomeUzs - totalExpensesUzs - totalAdvancesUzs - salaryPaidUzs,
        // Sale counts
        salesCount,
        serviceCount,
        totalSalesCount: salesCount + serviceCount,
        // Payment methods
        paymentMethods: methodMap,
        // Customers
        customerTotalDebtUzs: Number(customerDebtRaw._sum.initialDebtUzs ?? 0),
        newCustomers,
        // Workshop
        workshopPending,
        workshopInProgress,
        workshopCompleted,
        // Top cashiers
        topCashiers,
      };
    }),

  productSalesReport: protectedProcedure
    .input(z.object({
      dateFrom: z.string(),
      dateTo: z.string(),
      productId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const dateFrom = uzbStartOfDay(input.dateFrom);
      const dateTo = uzbEndOfDay(input.dateTo);

      const saleItems = await ctx.db.saleItem.findMany({
        where: {
          productId: input.productId ?? { not: null },
          sale: {
            createdAt: { gte: dateFrom, lte: dateTo },
            status: { not: "CANCELLED" },
          },
        },
        include: {
          product: {
            select: { id: true, name: true, code: true, unit: true, category: { select: { name: true } } },
          },
          sale: {
            select: {
              documentNo: true,
              createdAt: true,
              customer: { select: { fullName: true } },
              cashier: { select: { fullName: true } },
            },
          },
        },
        orderBy: { sale: { createdAt: "desc" } },
      });

      return saleItems.map((item) => ({
        saleDate: item.sale.createdAt,
        documentNo: item.sale.documentNo,
        customerName: item.sale.customer?.fullName ?? null,
        cashierName: item.sale.cashier.fullName,
        productId: item.product?.id ?? 0,
        productName: item.product?.name ?? "Noma'lum",
        productCode: item.product?.code ?? "",
        categoryName: item.product?.category.name ?? "",
        unit: item.product?.unit ?? "",
        quantity: Number(item.quantity),
        unitPriceUzs: Number(item.priceUzs),
        totalUzs: Number(item.totalUzs),
        totalUsd: Number(item.totalUsd),
      }));
    }),

  inventoryReport: protectedProcedure
    .query(async ({ ctx }) => {
      const stockItems = await ctx.db.stockItem.findMany({
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
