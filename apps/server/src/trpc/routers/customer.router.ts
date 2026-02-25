import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createCustomerSchema, updateCustomerSchema, searchCustomerSchema } from "@ezoz/shared";

export const customerRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const [customers, total] = await Promise.all([
        ctx.db.customer.findMany({
          where: { isActive: true },
          orderBy: { fullName: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.customer.count({ where: { isActive: true } }),
      ]);
      return { customers, total, page, limit };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.findUnique({
        where: { id: input.id },
        include: {
          sales: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { items: { include: { product: { select: { name: true } } } }, payments: true },
          },
          payments: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      });
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Mijoz topilmadi" });
      return customer;
    }),

  create: protectedProcedure
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.create({
        data: {
          fullName: input.fullName,
          phone: input.phone,
          phone2: input.phone2,
          birthday: input.birthday ? new Date(input.birthday) : null,
          address: input.address,
          category: input.category,
          initialDebtUzs: input.initialDebtUzs,
          initialDebtUsd: input.initialDebtUsd,
          notes: input.notes,
        },
      });
      return customer;
    }),

  update: protectedProcedure
    .input(updateCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (data.birthday) {
        updateData["birthday"] = new Date(data.birthday);
      }
      return ctx.db.customer.update({ where: { id }, data: updateData });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.customer.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  search: protectedProcedure
    .input(searchCustomerSchema)
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (input.query) {
        where["OR"] = [
          { fullName: { contains: input.query, mode: "insensitive" } },
          { phone: { contains: input.query } },
          { phone2: { contains: input.query } },
        ];
      }
      return ctx.db.customer.findMany({
        where,
        take: 20,
        orderBy: { fullName: "asc" },
      });
    }),

  getBirthdays: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const customers = await ctx.db.$queryRaw<Array<{ id: number; fullName: string; phone: string | null; birthday: Date }>>`
      SELECT id, "fullName", phone, birthday
      FROM "Customer"
      WHERE "isActive" = true
        AND birthday IS NOT NULL
        AND EXTRACT(MONTH FROM birthday) = ${month}
        AND EXTRACT(DAY FROM birthday) = ${day}
    `;
    return customers;
  }),

  getDebtSummary: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.findUnique({ where: { id: input.id } });
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });

      // Sales totals
      const salesTotal = await ctx.db.sale.aggregate({
        where: { customerId: input.id, status: { not: "CANCELLED" } },
        _sum: { totalUzs: true, totalUsd: true },
      });

      // Payments total
      const paymentsTotal = await ctx.db.payment.aggregate({
        where: { customerId: input.id },
        _sum: { amountUzs: true, amountUsd: true },
      });

      const totalDebtUzs = Number(customer.initialDebtUzs) + Number(salesTotal._sum.totalUzs ?? 0) - Number(paymentsTotal._sum.amountUzs ?? 0);
      const totalDebtUsd = Number(customer.initialDebtUsd) + Number(salesTotal._sum.totalUsd ?? 0) - Number(paymentsTotal._sum.amountUsd ?? 0);

      return {
        totalDebtUzs,
        totalDebtUsd,
        initialDebtUzs: Number(customer.initialDebtUzs),
        initialDebtUsd: Number(customer.initialDebtUsd),
        totalSalesUzs: Number(salesTotal._sum.totalUzs ?? 0),
        totalSalesUsd: Number(salesTotal._sum.totalUsd ?? 0),
        totalPaidUzs: Number(paymentsTotal._sum.amountUzs ?? 0),
        totalPaidUsd: Number(paymentsTotal._sum.amountUsd ?? 0),
      };
    }),

  // Returns completed/open sales with outstanding (unpaid) balance, oldest first
  getUnpaidSales: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const sales = await ctx.db.sale.findMany({
        where: { customerId: input.id, status: { not: "CANCELLED" } },
        include: {
          payments: { select: { amountUzs: true, amountUsd: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      });
      return sales
        .map((sale) => {
          const paidUzs = sale.payments.reduce((s, p) => s + Number(p.amountUzs), 0);
          const debtUzs = Number(sale.totalUzs) - paidUzs;
          return {
            id: sale.id,
            createdAt: sale.createdAt,
            totalUzs: Number(sale.totalUzs),
            paidUzs,
            debtUzs,
            items: sale.items.map((i) => ({
              name: i.product?.name ?? i.serviceName ?? "—",
              quantity: Number(i.quantity),
              totalUzs: Number(i.totalUzs),
            })),
          };
        })
        .filter((s) => s.debtUzs > 0.01);
    }),

  // Increases initialDebtUzs for manual debt entry (e.g. borrowed outside system)
  addManualDebt: protectedProcedure
    .input(z.object({
      id: z.number(),
      amountUzs: z.number().positive(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.customer.update({
        where: { id: input.id },
        data: { initialDebtUzs: Number(customer.initialDebtUzs) + input.amountUzs },
      });
    }),
});
