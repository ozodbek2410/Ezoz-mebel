import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { unlink } from "fs/promises";
import path from "path";
import { router, protectedProcedure, bossProcedure, publicProcedure } from "../trpc";
import { createProductSchema, updateProductSchema, createCategorySchema } from "@ezoz/shared";
import { env } from "../../config/env";

export const productRouter = router({
  list: protectedProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      warehouseId: z.number().optional(),
      search: z.string().optional(),
      cursor: z.number().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(1000).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const page = input?.page ?? 1;
      const searchFilter = input?.search ? {
        OR: [
          { name: { contains: input.search, mode: "insensitive" as const } },
          { code: { contains: input.search, mode: "insensitive" as const } },
          { sku: { contains: input.search, mode: "insensitive" as const } },
        ],
      } : {};

      const baseWhere = {
        isActive: true,
        ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
        ...searchFilter,
      };

      const [items, total] = await Promise.all([
        ctx.db.product.findMany({
          where: baseWhere,
          include: {
            category: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
            stockItems: input?.warehouseId
              ? { where: { warehouseId: input.warehouseId } }
              : true,
          },
          orderBy: { id: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.product.count({ where: baseWhere }),
      ]);

      return { items, total, nextCursor: undefined as number | undefined };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findUnique({
        where: { id: input.id },
        include: { category: true, stockItems: { include: { warehouse: true } }, images: true },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Mahsulot topilmadi" });
      return product;
    }),

  create: bossProcedure
    .input(createProductSchema)
    .mutation(async ({ ctx, input }) => {
      // Generate sequential 6-digit code (000001, 000002, ...)
      const lastProduct = await ctx.db.product.findFirst({
        where: { code: { not: { startsWith: "c" } } },
        orderBy: { code: "desc" },
        select: { code: true },
      });
      const nextNum = lastProduct ? Number(lastProduct.code) + 1 : 1;
      const code = String(nextNum).padStart(6, "0");

      return ctx.db.product.create({ data: { ...input, code } });
    }),

  update: bossProcedure
    .input(updateProductSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const product = await ctx.db.product.findUnique({ where: { id } });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      if (product.isLocked && ctx.user.role !== "BOSS") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Bu mahsulot qulflangan" });
      }
      return ctx.db.product.update({ where: { id }, data });
    }),

  delete: bossProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.product.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  addImage: bossProcedure
    .input(z.object({ productId: z.number(), filePath: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.productImage.findFirst({
        where: { productId: input.productId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      return ctx.db.productImage.create({
        data: {
          productId: input.productId,
          filePath: input.filePath,
          sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
        },
      });
    }),

  removeImage: bossProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const image = await ctx.db.productImage.findUnique({ where: { id: input.id } });
      if (!image) throw new TRPCError({ code: "NOT_FOUND" });

      // Delete file from disk
      try {
        const fullPath = path.resolve(env.UPLOAD_DIR, image.filePath.replace("/uploads/", ""));
        await unlink(fullPath);
      } catch {
        // File may not exist
      }

      return ctx.db.productImage.delete({ where: { id: input.id } });
    }),

  // Marketplace: public endpoint
  marketplace: publicProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 20;
      const [products, total] = await Promise.all([
        ctx.db.product.findMany({
          where: {
            isActive: true,
            ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
            ...(input?.search ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { description: { contains: input.search, mode: "insensitive" } },
              ],
            } : {}),
          },
          include: { category: true, images: true },
          orderBy: { name: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.product.count({
          where: {
            isActive: true,
            ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
          },
        }),
      ]);
      return { products, total, page, limit };
    }),

  // Public product detail
  marketplaceDetail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findUnique({
        where: { id: input.id, isActive: true },
        include: {
          category: true,
          images: { orderBy: { sortOrder: "asc" } },
          stockItems: {
            where: { quantity: { gt: 0 } },
            include: { warehouse: { select: { name: true } } },
          },
        },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Mahsulot topilmadi" });
      return product;
    }),
});

export const categoryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      include: { children: true, _count: { select: { products: { where: { isActive: true } } } } },
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
    });
  }),

  getTree: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      include: {
        children: {
          include: {
            children: true,
            _count: { select: { products: { where: { isActive: true } } } },
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { products: { where: { isActive: true } } } },
      },
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
    });
  }),

  create: bossProcedure
    .input(createCategorySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.category.create({ data: input });
    }),

  update: bossProcedure
    .input(z.object({ id: z.number(), name: z.string(), sortOrder: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.category.update({ where: { id }, data });
    }),

  delete: bossProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const hasProducts = await ctx.db.product.count({ where: { categoryId: input.id } });
      if (hasProducts > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bu guruhda mahsulotlar bor. Avval ularni boshqa guruhga ko'chiring." });
      }
      return ctx.db.category.delete({ where: { id: input.id } });
    }),
});
