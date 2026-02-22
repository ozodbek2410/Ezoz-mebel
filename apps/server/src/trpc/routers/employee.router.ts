import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, bossProcedure, protectedProcedure } from "../trpc";
import { createAdvanceSchema, createJobRecordSchema } from "@ezoz/shared";

export const employeeRouter = router({
  // List all active users with advance/job counts
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        role: true,
        baseSalaryUzs: true,
        bonusPerJob: true,
        _count: { select: { advances: true, jobRecords: true } },
      },
      orderBy: { fullName: "asc" },
    });
  }),

  // Get user detail with advances, job records, salary payments
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          username: true,
          fullName: true,
          phone: true,
          role: true,
          baseSalaryUzs: true,
          bonusPerJob: true,
          advances: { orderBy: { givenAt: "desc" }, take: 50 },
          jobRecords: { orderBy: { date: "desc" }, take: 50 },
          salaryPayments: { orderBy: { paidAt: "desc" }, take: 12 },
        },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return user;
    }),

  addAdvance: bossProcedure
    .input(createAdvanceSchema)
    .mutation(async ({ ctx, input }) => {
      const advance = await ctx.db.advance.create({ data: input });
      await ctx.db.cashRegisterOp.create({
        data: {
          registerType: input.cashRegister,
          operationType: "ADVANCE_PAYMENT",
          amountUzs: input.amountUzs,
          amountUsd: 0,
          balanceAfterUzs: 0,
          balanceAfterUsd: 0,
          description: `Avans: ${input.notes ?? ""}`,
          userId: ctx.user.userId,
        },
      });
      return advance;
    }),

  addJobRecord: bossProcedure
    .input(createJobRecordSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.jobRecord.create({ data: input });
    }),

  calculateSalary: bossProcedure
    .input(z.object({ userId: z.number(), month: z.number(), year: z.number() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0, 23, 59, 59);

      const [advances, jobs] = await Promise.all([
        ctx.db.advance.aggregate({
          where: { userId: input.userId, givenAt: { gte: startDate, lte: endDate } },
          _sum: { amountUzs: true },
        }),
        ctx.db.jobRecord.aggregate({
          where: { userId: input.userId, date: { gte: startDate, lte: endDate } },
          _sum: { bonusUzs: true },
        }),
      ]);

      const baseSalary = Number(user.baseSalaryUzs);
      const totalBonus = Number(jobs._sum.bonusUzs ?? 0);
      const totalAdvance = Number(advances._sum.amountUzs ?? 0);
      const netPayment = baseSalary + totalBonus - totalAdvance;

      return { baseSalary, totalBonus, totalAdvance, netPayment };
    }),

  paySalary: bossProcedure
    .input(z.object({
      userId: z.number(),
      month: z.number(),
      year: z.number(),
      baseSalary: z.number(),
      totalBonus: z.number(),
      totalAdvance: z.number(),
      netPayment: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.salaryPayment.create({ data: input });
    }),
});
