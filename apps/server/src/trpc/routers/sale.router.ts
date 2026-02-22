import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { createSaleSchema, createPaymentSchema } from "@ezoz/shared";

export const saleRouter = router({
  create: protectedProcedure
    .input(createSaleSchema)
    .mutation(async ({ ctx, input }) => {
      const todayRate = await ctx.db.exchangeRate.findFirst({
        orderBy: { date: "desc" },
      });
      if (!todayRate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bugungi valyuta kursi kiritilmagan" });
      }

      const rate = Number(todayRate.rate);

      // Validate minimum prices for non-boss
      if (ctx.user.role !== "BOSS") {
        for (const item of input.items) {
          if (item.productId) {
            const product = await ctx.db.product.findUnique({ where: { id: item.productId } });
            if (product && item.priceUzs < Number(product.minPriceUzs)) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: `"${product.name}" minimal narxi ${product.minPriceUzs} so'm. Bundan past sotib bo'lmaydi.`,
              });
            }
          }
        }
      }

      // Calculate totals
      let totalUzs = 0;
      let totalUsd = 0;
      const saleItems = input.items.map((item) => {
        const itemTotalUzs = item.priceUzs * Number(item.quantity);
        const itemTotalUsd = item.priceUsd * Number(item.quantity);
        totalUzs += itemTotalUzs;
        totalUsd += itemTotalUsd;
        return {
          productId: item.productId ?? null,
          serviceName: item.serviceName ?? null,
          quantity: item.quantity,
          priceUzs: item.priceUzs,
          priceUsd: item.priceUsd,
          totalUzs: itemTotalUzs,
          totalUsd: itemTotalUsd,
        };
      });

      const sale = await ctx.db.sale.create({
        data: {
          customerId: input.customerId ?? null,
          warehouseId: input.warehouseId ?? null,
          cashierId: ctx.user.userId,
          saleType: input.saleType,
          totalUzs,
          totalUsd,
          exchangeRate: rate,
          goesToWorkshop: input.goesToWorkshop,
          workshopStatus: input.goesToWorkshop ? "PENDING" : null,
          notes: input.notes,
          items: { create: saleItems },
        },
        include: { items: true },
      });

      // Create workshop task if "Sexga o'tadi"
      if (input.goesToWorkshop) {
        await ctx.db.workshopTask.create({
          data: {
            saleId: sale.id,
            description: `Sotuv #${sale.documentNo} - kesish/xizmat`,
            assignedToId: input.assignedToId ?? null,
          },
        });
        ctx.io?.to("room:workshop").emit("workshop:newTask", {
          taskId: sale.id,
          description: `Yangi vazifa: Sotuv #${sale.documentNo}`,
        });
      }

      // Broadcast sale created
      ctx.io?.to("room:sales").to("room:boss").emit("sale:created", {
        saleId: sale.id,
        saleType: sale.saleType,
        cashierId: sale.cashierId,
      });

      return sale;
    }),

  list: protectedProcedure
    .input(z.object({
      status: z.enum(["OPEN", "COMPLETED", "CANCELLED", "RETURNED"]).optional(),
      saleType: z.enum(["PRODUCT", "SERVICE"]).optional(),
      customerId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;

      const where: Record<string, unknown> = {};
      if (input?.status) where["status"] = input.status;
      if (input?.saleType) where["saleType"] = input.saleType;
      if (input?.customerId) where["customerId"] = input.customerId;
      if (input?.dateFrom || input?.dateTo) {
        where["createdAt"] = {
          ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
          ...(input.dateTo ? { lte: new Date(input.dateTo + "T23:59:59") } : {}),
        };
      }

      // Cashiers only see their own sales
      if (ctx.user.role === "CASHIER_SALES") {
        where["saleType"] = "PRODUCT";
      } else if (ctx.user.role === "CASHIER_SERVICE") {
        where["saleType"] = "SERVICE";
      }

      const [sales, total] = await Promise.all([
        ctx.db.sale.findMany({
          where,
          include: {
            customer: { select: { id: true, fullName: true, phone: true } },
            cashier: { select: { id: true, fullName: true } },
            items: true,
            _count: { select: { payments: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.sale.count({ where }),
      ]);
      return { sales, total, page, limit };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const sale = await ctx.db.sale.findUnique({
        where: { id: input.id },
        include: {
          customer: true,
          cashier: { select: { id: true, fullName: true, role: true } },
          items: { include: { product: true } },
          payments: true,
          workshopTasks: { include: { photos: true } },
          receipt: true,
        },
      });
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Sotuv topilmadi" });
      return sale;
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sale = await ctx.db.sale.findUnique({
        where: { id: input.id },
        include: { items: true },
      });
      if (!sale) throw new TRPCError({ code: "NOT_FOUND" });
      if (sale.status !== "OPEN") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bu sotuv allaqachon yakunlangan" });
      }

      // Decrement stock from the specific warehouse
      if (sale.warehouseId) {
        for (const item of sale.items) {
          if (item.productId) {
            await ctx.db.stockItem.update({
              where: {
                productId_warehouseId: {
                  productId: item.productId,
                  warehouseId: sale.warehouseId,
                },
              },
              data: { quantity: { decrement: Number(item.quantity) } },
            });

            // Check low stock
            const stock = await ctx.db.stockItem.findUnique({
              where: {
                productId_warehouseId: {
                  productId: item.productId,
                  warehouseId: sale.warehouseId,
                },
              },
              include: { product: true },
            });
            if (stock && Number(stock.quantity) <= Number(stock.product.minStockAlert)) {
              ctx.io?.to("room:stock").emit("stock:low", {
                productId: item.productId,
                productName: stock.product.name,
                qty: Number(stock.quantity),
              });
            }
          }
        }
        ctx.io?.to("room:stock").emit("stock:updated", { warehouseId: sale.warehouseId });
      }

      const updated = await ctx.db.sale.update({
        where: { id: input.id },
        data: { status: "COMPLETED" },
      });

      ctx.io?.to("room:sales").to("room:boss").emit("sale:completed", {
        saleId: sale.id,
        total: { uzs: Number(sale.totalUzs), usd: Number(sale.totalUsd) },
      });

      return updated;
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.sale.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      });
    }),
});

export const paymentRouter = router({
  create: protectedProcedure
    .input(createPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const cashRegister = ctx.user.role === "CASHIER_SERVICE" ? "SERVICE" : "SALES";

      const payment = await ctx.db.payment.create({
        data: {
          saleId: input.saleId ?? null,
          customerId: input.customerId ?? null,
          amountUzs: input.amountUzs,
          amountUsd: input.amountUsd,
          paymentType: input.paymentType,
          cashRegister: cashRegister as "SALES" | "SERVICE",
          source: input.source,
          notes: input.notes,
        },
      });

      // Record cash register operation
      await ctx.db.cashRegisterOp.create({
        data: {
          registerType: cashRegister as "SALES" | "SERVICE",
          operationType: input.source === "OLD_DEBT" ? "DEBT_PAYMENT" : "SALE_INCOME",
          amountUzs: input.amountUzs,
          amountUsd: input.amountUsd,
          balanceAfterUzs: 0, // Will be calculated
          balanceAfterUsd: 0,
          description: input.notes,
          userId: ctx.user.userId,
        },
      });

      ctx.io?.to("room:boss").emit("cashRegister:updated", {
        registerType: cashRegister,
        balanceUzs: 0,
        balanceUsd: 0,
      });

      return payment;
    }),

  listByCustomer: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.payment.findMany({
        where: { customerId: input.customerId },
        orderBy: { createdAt: "desc" },
      });
    }),
});
