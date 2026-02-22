import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, bossProcedure, cashierSalesProcedure } from "../trpc";

export const warehouseRouter = router({
  listWarehouses: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.warehouse.findMany({ where: { isActive: true } });
  }),

  getStock: protectedProcedure
    .input(z.object({
      warehouseId: z.number().optional(),
      categoryId: z.number().optional(),
      lowStockOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const stockItems = await ctx.db.stockItem.findMany({
        where: {
          ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
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
      warehouseId: z.number(),
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
          warehouseId: input.warehouseId,
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
          where: { productId_warehouseId: { productId: item.productId, warehouseId: input.warehouseId } },
          update: { quantity: { increment: item.quantity } },
          create: { productId: item.productId, warehouseId: input.warehouseId, quantity: item.quantity },
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
            description: `Kirim #${purchase.documentNo}${supplierName ? ` — ${supplierName}` : ""}`,
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
            description: `Kirim #${purchase.documentNo}`,
            userId: ctx.user.userId,
          },
        });
      }

      ctx.io?.to("room:stock").emit("stock:updated", { warehouseId: input.warehouseId });
      return purchase;
    }),

  transfer: protectedProcedure
    .input(z.object({
      fromWarehouseId: z.number(),
      toWarehouseId: z.number(),
      productId: z.number(),
      quantity: z.number().positive(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check source stock
      const sourceStock = await ctx.db.stockItem.findUnique({
        where: { productId_warehouseId: { productId: input.productId, warehouseId: input.fromWarehouseId } },
      });
      if (!sourceStock || Number(sourceStock.quantity) < input.quantity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Omborida yetarli mahsulot yo'q" });
      }

      const transfer = await ctx.db.transfer.create({ data: input });

      // Decrement source
      await ctx.db.stockItem.update({
        where: { productId_warehouseId: { productId: input.productId, warehouseId: input.fromWarehouseId } },
        data: { quantity: { decrement: input.quantity } },
      });

      // Increment destination
      await ctx.db.stockItem.upsert({
        where: { productId_warehouseId: { productId: input.productId, warehouseId: input.toWarehouseId } },
        update: { quantity: { increment: input.quantity } },
        create: { productId: input.productId, warehouseId: input.toWarehouseId, quantity: input.quantity },
      });

      ctx.io?.to("room:stock").emit("stock:updated", { warehouseId: input.fromWarehouseId });
      return transfer;
    }),

  // Write-off (realizatsiya/chiqim)
  writeOff: bossProcedure
    .input(z.object({
      warehouseId: z.number(),
      productId: z.number(),
      quantity: z.number().positive(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const stock = await ctx.db.stockItem.findUnique({
        where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
      });
      if (!stock || Number(stock.quantity) < input.quantity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Omborida yetarli mahsulot yo'q" });
      }

      await ctx.db.stockItem.update({
        where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
        data: { quantity: { decrement: input.quantity } },
      });

      ctx.io?.to("room:stock").emit("stock:updated", { warehouseId: input.warehouseId });
      return { success: true };
    }),

  // Return to stock (qaytarish)
  returnToStock: protectedProcedure
    .input(z.object({
      warehouseId: z.number(),
      productId: z.number(),
      quantity: z.number().positive(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.stockItem.upsert({
        where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
        update: { quantity: { increment: input.quantity } },
        create: { productId: input.productId, warehouseId: input.warehouseId, quantity: input.quantity },
      });

      ctx.io?.to("room:stock").emit("stock:updated", { warehouseId: input.warehouseId });
      return { success: true };
    }),

  // Inventory check - create
  createInventoryCheck: bossProcedure
    .input(z.object({
      warehouseId: z.number(),
      items: z.array(z.object({
        productId: z.number(),
        actualQty: z.number().nonnegative(),
      })).min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get expected quantities
      const stockItems = await ctx.db.stockItem.findMany({
        where: { warehouseId: input.warehouseId },
      });
      const stockMap = new Map(stockItems.map((s) => [s.productId, Number(s.quantity)]));

      const check = await ctx.db.inventoryCheck.create({
        data: {
          warehouseId: input.warehouseId,
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

      // Update stock for each item
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

      ctx.io?.to("room:stock").emit("stock:updated", { warehouseId: check.warehouseId });
      return { success: true };
    }),

  // List inventory checks
  listInventoryChecks: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.inventoryCheck.findMany({
      include: { items: { include: { inventoryCheck: false } }, },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  // List revaluations
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
      warehouseId: z.number(),
      quantity: z.number().nonnegative(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.stockItem.upsert({
        where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
        update: { quantity: input.quantity },
        create: { productId: input.productId, warehouseId: input.warehouseId, quantity: input.quantity },
      });

      ctx.io?.to("room:stock").emit("stock:updated", { warehouseId: input.warehouseId });
      return { success: true };
    }),
});
