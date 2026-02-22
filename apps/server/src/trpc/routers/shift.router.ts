import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

export const shiftRouter = router({
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.shift.findFirst({
      where: { userId: ctx.user.userId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
  }),

  open: protectedProcedure
    .input(z.object({
      exchangeRate: z.number().positive(),
      openingBalanceUzs: z.number().nonnegative().default(0),
      openingBalanceUsd: z.number().nonnegative().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if there's already an open shift
      const existing = await ctx.db.shift.findFirst({
        where: { userId: ctx.user.userId, status: "OPEN" },
      });
      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sizda allaqachon ochiq smena bor" });
      }

      const shift = await ctx.db.shift.create({
        data: {
          userId: ctx.user.userId,
          exchangeRate: input.exchangeRate,
          openingBalanceUzs: input.openingBalanceUzs,
          openingBalanceUsd: input.openingBalanceUsd,
        },
      });

      ctx.io?.to("room:boss").emit("shift:opened", {
        userId: ctx.user.userId,
        shiftId: shift.id,
      });

      return shift;
    }),

  close: protectedProcedure
    .input(z.object({ shiftId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const shift = await ctx.db.shift.findUnique({ where: { id: input.shiftId } });
      if (!shift) throw new TRPCError({ code: "NOT_FOUND" });

      // Check for open sales
      const openSales = await ctx.db.sale.count({
        where: { cashierId: ctx.user.userId, status: "OPEN" },
      });
      if (openSales > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${openSales} ta ochiq sotuv hujjati bor. Avval ularni yoping.`,
        });
      }

      const updated = await ctx.db.shift.update({
        where: { id: input.shiftId },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
      });

      ctx.io?.to("room:boss").emit("shift:closed", {
        userId: ctx.user.userId,
        shiftId: shift.id,
      });

      return updated;
    }),
});
