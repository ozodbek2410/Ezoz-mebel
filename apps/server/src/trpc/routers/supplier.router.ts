import { z } from "zod";
import { router, protectedProcedure, bossProcedure } from "../trpc";

export const supplierRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }),

  create: bossProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      notes: z.string().optional(),
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
});
