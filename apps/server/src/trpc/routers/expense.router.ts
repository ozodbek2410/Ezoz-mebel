import { z } from "zod";
import { router, protectedProcedure, bossProcedure } from "../trpc";
import { createExpenseSchema, createExpenseCategorySchema } from "@ezoz/shared";

export const expenseRouter = router({
  create: protectedProcedure
    .input(createExpenseSchema)
    .mutation(async ({ ctx, input }) => {
      const expense = await ctx.db.expense.create({
        data: {
          categoryId: input.categoryId,
          amountUzs: input.amountUzs,
          amountUsd: input.amountUsd,
          description: input.description,
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
          description: `Xarajat: ${input.description}`,
          userId: ctx.user.userId,
        },
      });

      return expense;
    }),

  list: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      categoryId: z.number().optional(),
      cashRegister: z.enum(["SALES", "SERVICE"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.expense.findMany({
        where: {
          ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input?.cashRegister ? { cashRegister: input.cashRegister } : {}),
          ...(input?.dateFrom || input?.dateTo ? {
            createdAt: {
              ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
              ...(input.dateTo ? { lte: new Date(input.dateTo + "T23:59:59") } : {}),
            },
          } : {}),
        },
        include: { category: true, user: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  categories: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }),

  createCategory: bossProcedure
    .input(createExpenseCategorySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.expenseCategory.create({ data: input });
    }),
});
