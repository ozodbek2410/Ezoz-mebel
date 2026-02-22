import { z } from "zod";
import { router, protectedProcedure, bossProcedure, publicProcedure } from "../trpc";

export const settingsRouter = router({
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.db.setting.findUnique({ where: { key: input.key } });
      return setting?.value ?? null;
    }),

  set: bossProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.setting.upsert({
        where: { key: input.key },
        update: { value: input.value },
        create: input,
      });
    }),

  getTableConfig: protectedProcedure
    .input(z.object({ tableName: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = await ctx.db.tableConfig.findUnique({
        where: { userId_tableName: { userId: ctx.user.userId, tableName: input.tableName } },
      });
      return config?.columnConfig ? JSON.parse(config.columnConfig) : null;
    }),

  setTableConfig: protectedProcedure
    .input(z.object({ tableName: z.string(), columnConfig: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.tableConfig.upsert({
        where: { userId_tableName: { userId: ctx.user.userId, tableName: input.tableName } },
        update: { columnConfig: input.columnConfig },
        create: { userId: ctx.user.userId, ...input },
      });
    }),

  getNotes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.note.findFirst({ orderBy: { updatedAt: "desc" } });
  }),

  saveNote: protectedProcedure
    .input(z.object({ content: z.string().max(800) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.note.findFirst();
      if (existing) {
        return ctx.db.note.update({
          where: { id: existing.id },
          data: { content: input.content },
        });
      }
      return ctx.db.note.create({
        data: { content: input.content, createdById: ctx.user.userId },
      });
    }),

  getCompanyInfo: publicProcedure.query(async ({ ctx }) => {
    const info = await ctx.db.companyInfo.findMany();
    return Object.fromEntries(info.map((i) => [i.key, i.value]));
  }),

  setCompanyInfo: bossProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.companyInfo.upsert({
        where: { key: input.key },
        update: { value: input.value },
        create: input,
      });
    }),
});
