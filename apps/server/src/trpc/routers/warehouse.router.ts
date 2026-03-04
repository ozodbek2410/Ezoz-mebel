import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PrismaClient } from "@prisma/client";
import { router, protectedProcedure, bossProcedure, cashierSalesProcedure } from "../trpc";

/** Get the single warehouse ID (auto-detect) */
async function getWarehouseId(db: PrismaClient): Promise<number> {
  const wh = await db.warehouse.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!wh) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Ombor topilmadi" });
  return wh.id;
}

export const warehouseRouter = router({
  /** Returns the single warehouse ID for frontend use */
  getWarehouseId: protectedProcedure.query(async ({ ctx }) => {
    return getWarehouseId(ctx.db);
  }),

  getStock: protectedProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      lowStockOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const warehouseId = await getWarehouseId(ctx.db);
      const stockItems = await ctx.db.stockItem.findMany({
        where: {
          warehouseId,
          product: {
            isActive: true,
            ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
          },
        },
        include: {
          product: { include: { category: true } },
          warehouse: true,
        },
        orderBy: { product: { name: "asc" } },
      });

      if (input?.lowStockOnly) {
        return stockItems.filter(
          (s) => Number(s.quantity) <= Number(s.product.minStockAlert)
        );
      }
      return stockItems;
    }),

  listPurchases: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.purchase.findMany({
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }),

  getPurchaseById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const purchase = await ctx.db.purchase.findUnique({
        where: { id: input.id },
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
      });
      if (!purchase) throw new TRPCError({ code: "NOT_FOUND" });
      return purchase;
    }),

  purchase: cashierSalesProcedure
    .input(z.object({
      supplierId: z.number().optional(),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number().positive(),
        priceUzs: z.number().nonnegative(),
        priceUsd: z.number().nonnegative(),
      })).min(1),
      notes: z.string().optional(),
      cashRegister: z.enum(["SALES", "SERVICE"]).default("SALES"),
      paymentType: z.enum(["CASH_UZS", "CASH_USD", "CARD", "TRANSFER"]).default("CASH_UZS"),
    }))
    .mutation(async ({ ctx, input }) => {
      const warehouseId = await getWarehouseId(ctx.db);
      const todayRate = await ctx.db.exchangeRate.findFirst({ orderBy: { date: "desc" } });
      if (!todayRate) throw new TRPCError({ code: "BAD_REQUEST", message: "Valyuta kursi kiritilmagan" });

      let totalUzs = 0;
      let totalUsd = 0;
      for (const item of input.items) {
        totalUzs += item.priceUzs * item.quantity;
        totalUsd += item.priceUsd * item.quantity;
      }

      const purchase = await ctx.db.purchase.create({
        data: {
          supplierId: input.supplierId ?? null,
          warehouseId,
          totalUzs,
          totalUsd,
          exchangeRate: todayRate.rate,
          notes: input.notes,
          items: {
            create: input.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              priceUzs: i.priceUzs,
              priceUsd: i.priceUsd,
            })),
          },
        },
        include: { items: true },
      });

      // Update stock
      for (const item of input.items) {
        await ctx.db.stockItem.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId } },
          update: { quantity: { increment: item.quantity } },
          create: { productId: item.productId, warehouseId, quantity: item.quantity },
        });
      }

      // Auto-create expense for purchase
      if (totalUzs > 0 || totalUsd > 0) {
        let expenseCategory = await ctx.db.expenseCategory.findFirst({
          where: { name: "Mahsulot kirimi" },
        });
        if (!expenseCategory) {
          expenseCategory = await ctx.db.expenseCategory.create({
            data: { name: "Mahsulot kirimi" },
          });
        }

        const supplierName = input.supplierId
          ? (await ctx.db.supplier.findUnique({ where: { id: input.supplierId }, select: { name: true } }))?.name
          : null;

        await ctx.db.expense.create({
          data: {
            categoryId: expenseCategory.id,
            amountUzs: totalUzs,
            amountUsd: totalUsd,
            description: `Kirim #${purchase.id}${supplierName ? ` — ${supplierName}` : ""}`,
            cashRegister: input.cashRegister,
            paymentType: input.paymentType,
            userId: ctx.user.userId,
          },
        });

        await ctx.db.cashRegisterOp.create({
          data: {
            registerType: input.cashRegister,
            operationType: "EXPENSE",
            amountUzs: totalUzs,
            amountUsd: totalUsd,
            balanceAfterUzs: 0,
            balanceAfterUsd: 0,
            description: `Kirim #${purchase.id}`,
            userId: ctx.user.userId,
          },
        });
      }

      ctx.io?.to("room:stock").emit("stock:updated", {});
      return purchase;
    }),

  // Write-off (realizatsiya/chiqim)
  writeOff: bossProcedure
    .input(z.object({
      productId: z.number(),
      quantity: z.number().positive(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const warehouseId = await getWarehouseId(ctx.db);
      const stock = await ctx.db.stockItem.findUnique({
        where: { productId_warehouseId: { productId: input.productId, warehouseId } },
      });
      if (!stock || Number(stock.quantity) < input.quantity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Omborida yetarli mahsulot yo'q" });
      }

      await ctx.db.stockItem.update({
        where: { productId_warehouseId: { productId: input.productId, warehouseId } },
        data: { quantity: { decrement: input.quantity } },
      });

      ctx.io?.to("room:stock").emit("stock:updated", {});
      return { success: true };
    }),

  // Return to stock (qaytarish)
  returnToStock: protectedProcedure
    .input(z.object({
      productId: z.number(),
      quantity: z.number().positive(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const warehouseId = await getWarehouseId(ctx.db);
      await ctx.db.stockItem.upsert({
        where: { productId_warehouseId: { productId: input.productId, warehouseId } },
        update: { quantity: { increment: input.quantity } },
        create: { productId: input.productId, warehouseId, quantity: input.quantity },
      });

      ctx.io?.to("room:stock").emit("stock:updated", {});
      return { success: true };
    }),

  // Inventory check - create
  createInventoryCheck: bossProcedure
    .input(z.object({
      items: z.array(z.object({
        productId: z.number(),
        actualQty: z.number().nonnegative(),
      })).min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const warehouseId = await getWarehouseId(ctx.db);
      const stockItems = await ctx.db.stockItem.findMany({
        where: { warehouseId },
      });
      const stockMap = new Map(stockItems.map((s) => [s.productId, Number(s.quantity)]));

      const check = await ctx.db.inventoryCheck.create({
        data: {
          warehouseId,
          notes: input.notes,
          items: {
            create: input.items.map((item) => {
              const expected = stockMap.get(item.productId) ?? 0;
              return {
                productId: item.productId,
                expectedQty: expected,
                actualQty: item.actualQty,
                difference: item.actualQty - expected,
              };
            }),
          },
        },
        include: { items: true },
      });

      return check;
    }),

  // Apply inventory check - update stock to actual values
  applyInventoryCheck: bossProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.inventoryCheck.findUnique({
        where: { id: input.id },
        include: { items: true },
      });
      if (!check) throw new TRPCError({ code: "NOT_FOUND" });
      if (check.status === "COMPLETED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bu inventarizatsiya allaqachon yakunlangan" });
      }

      for (const item of check.items) {
        await ctx.db.stockItem.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: check.warehouseId } },
          update: { quantity: item.actualQty },
          create: { productId: item.productId, warehouseId: check.warehouseId, quantity: item.actualQty },
        });
      }

      await ctx.db.inventoryCheck.update({
        where: { id: input.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      ctx.io?.to("room:stock").emit("stock:updated", {});
      return { success: true };
    }),

  listInventoryChecks: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.inventoryCheck.findMany({
      include: { items: { include: { inventoryCheck: false } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  listRevaluations: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.revaluation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  revalue: bossProcedure
    .input(z.object({
      productId: z.number(),
      newPriceUzs: z.number().nonnegative(),
      newPriceUsd: z.number().nonnegative(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.product.findUnique({ where: { id: input.productId } });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      const revaluation = await ctx.db.revaluation.create({
        data: {
          productId: input.productId,
          oldPriceUzs: product.costPriceUzs,
          newPriceUzs: input.newPriceUzs,
          oldPriceUsd: product.costPriceUsd,
          newPriceUsd: input.newPriceUsd,
          reason: input.reason,
          createdById: ctx.user.userId,
        },
      });

      await ctx.db.product.update({
        where: { id: input.productId },
        data: { costPriceUzs: input.newPriceUzs, costPriceUsd: input.newPriceUsd },
      });

      return revaluation;
    }),

  updateStock: bossProcedure
    .input(z.object({
      productId: z.number(),
      quantity: z.number().nonnegative(),
    }))
    .mutation(async ({ ctx, input }) => {
      const warehouseId = await getWarehouseId(ctx.db);
      await ctx.db.stockItem.upsert({
        where: { productId_warehouseId: { productId: input.productId, warehouseId } },
        update: { quantity: input.quantity },
        create: { productId: input.productId, warehouseId, quantity: input.quantity },
      });

      ctx.io?.to("room:stock").emit("stock:updated", {});
      return { success: true };
    }),
});
