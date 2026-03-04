import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, bossProcedure } from "../trpc";

export const supplierRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const [suppliers, total] = await Promise.all([
        ctx.db.supplier.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          skip: (page - 1) * limit,
          take: limit,
          include: { _count: { select: { purchases: true } } },
        }),
        ctx.db.supplier.count({ where: { isActive: true } }),
      ]);
      return { suppliers, total, page, limit };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const supplier = await ctx.db.supplier.findUnique({
        where: { id: input.id },
        include: {
          purchases: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
              items: { include: { product: { select: { name: true, code: true } } } },
              payments: { select: { amountUzs: true, amountUsd: true, paymentType: true, createdAt: true } },
            },
          },
          payments: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      });
      if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Ta'minotchi topilmadi" });
      return supplier;
    }),

  create: bossProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      notes: z.string().optional(),
      initialDebtUzs: z.number().nonnegative().default(0),
      initialDebtUsd: z.number().nonnegative().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.supplier.create({ data: input });
    }),

  update: bossProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      initialDebtUzs: z.number().nonnegative().optional(),
      initialDebtUsd: z.number().nonnegative().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.supplier.update({ where: { id }, data });
    }),

  delete: bossProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.supplier.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (input.query) {
        where["OR"] = [
          { name: { contains: input.query, mode: "insensitive" } },
          { phone: { contains: input.query } },
        ];
      }
      return ctx.db.supplier.findMany({
        where,
        take: 20,
        orderBy: { name: "asc" },
      });
    }),

  getDebtSummary: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const supplier = await ctx.db.supplier.findUnique({ where: { id: input.id } });
      if (!supplier) throw new TRPCError({ code: "NOT_FOUND" });

      const purchasesTotal = await ctx.db.purchase.aggregate({
        where: { supplierId: input.id, status: { not: "CANCELLED" } },
        _sum: { totalUzs: true, totalUsd: true },
      });

      const paymentsTotal = await ctx.db.supplierPayment.aggregate({
        where: { supplierId: input.id },
        _sum: { amountUzs: true, amountUsd: true },
      });

      const totalDebtUzs = Number(supplier.initialDebtUzs) + Number(purchasesTotal._sum.totalUzs ?? 0) - Number(paymentsTotal._sum.amountUzs ?? 0);
      const totalDebtUsd = Number(supplier.initialDebtUsd) + Number(purchasesTotal._sum.totalUsd ?? 0) - Number(paymentsTotal._sum.amountUsd ?? 0);

      return {
        totalDebtUzs,
        totalDebtUsd,
        initialDebtUzs: Number(supplier.initialDebtUzs),
        initialDebtUsd: Number(supplier.initialDebtUsd),
        totalPurchasesUzs: Number(purchasesTotal._sum.totalUzs ?? 0),
        totalPurchasesUsd: Number(purchasesTotal._sum.totalUsd ?? 0),
        totalPaidUzs: Number(paymentsTotal._sum.amountUzs ?? 0),
        totalPaidUsd: Number(paymentsTotal._sum.amountUsd ?? 0),
      };
    }),

  getUnpaidPurchases: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const purchases = await ctx.db.purchase.findMany({
        where: { supplierId: input.id, status: { not: "CANCELLED" } },
        include: {
          payments: { select: { amountUzs: true, amountUsd: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      });
      return purchases
        .map((p) => {
          const paidUzs = p.payments.reduce((s, pay) => s + Number(pay.amountUzs), 0);
          const debtUzs = Number(p.totalUzs) - paidUzs;
          return {
            id: p.id,
            documentNo: p.documentNo,
            createdAt: p.createdAt,
            totalUzs: Number(p.totalUzs),
            paidUzs,
            debtUzs,
            items: p.items.map((i) => ({
              name: i.product?.name ?? "—",
              quantity: Number(i.quantity),
              priceUzs: Number(i.priceUzs),
            })),
          };
        })
        .filter((p) => p.debtUzs > 0.01);
    }),

  payDebt: protectedProcedure
    .input(z.object({
      supplierId: z.number(),
      purchaseId: z.number().optional(),
      amountUzs: z.number().positive(),
      amountUsd: z.number().nonnegative().default(0),
      paymentType: z.enum(["CASH_UZS", "CASH_USD", "CARD", "TRANSFER"]),
      cashRegister: z.enum(["SALES", "SERVICE"]).default("SALES"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.supplierPayment.create({
        data: {
          supplierId: input.supplierId,
          purchaseId: input.purchaseId ?? null,
          amountUzs: input.amountUzs,
          amountUsd: input.amountUsd,
          paymentType: input.paymentType,
          cashRegister: input.cashRegister,
          notes: input.notes,
          userId: ctx.user.userId,
        },
      });

      // Create expense record
      let expenseCategory = await ctx.db.expenseCategory.findFirst({
        where: { name: "Ta'minotchi to'lovi" },
      });
      if (!expenseCategory) {
        expenseCategory = await ctx.db.expenseCategory.create({
          data: { name: "Ta'minotchi to'lovi" },
        });
      }

      const supplier = await ctx.db.supplier.findUnique({ where: { id: input.supplierId }, select: { name: true } });

      await ctx.db.expense.create({
        data: {
          categoryId: expenseCategory.id,
          amountUzs: input.amountUzs,
          amountUsd: input.amountUsd,
          description: `Qarz to'lash — ${supplier?.name ?? ""}`,
          cashRegister: input.cashRegister,
          paymentType: input.paymentType,
          userId: ctx.user.userId,
        },
      });

      await ctx.db.cashRegisterOp.create({
        data: {
          registerType: input.cashRegister,
          operationType: "EXPENSE",
          amountUzs: input.amountUzs,
          amountUsd: input.amountUsd,
          balanceAfterUzs: 0,
          balanceAfterUsd: 0,
          description: `Ta'minotchi qarz to'lash — ${supplier?.name ?? ""}`,
          userId: ctx.user.userId,
        },
      });

      return payment;
    }),
});
