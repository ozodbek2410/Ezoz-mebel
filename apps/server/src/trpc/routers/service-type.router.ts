import { z } from "zod";
import { router, protectedProcedure, bossProcedure } from "../trpc";

export const serviceTypeRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.serviceType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }),

  create: bossProcedure
    .input(z.object({
      name: z.string().min(1),
      priceUzs: z.number().nonnegative().default(0),
      priceUsd: z.number().nonnegative().default(0),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.serviceType.create({ data: input });
    }),

  update: bossProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      priceUzs: z.number().nonnegative().optional(),
      priceUsd: z.number().nonnegative().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.serviceType.update({ where: { id }, data });
    }),

  delete: bossProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.serviceType.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),
});
