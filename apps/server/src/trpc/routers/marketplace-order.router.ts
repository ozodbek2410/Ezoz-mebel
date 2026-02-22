import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";

const createOrderSchema = z.object({
  customerName: z.string().min(2, "Ism kamida 2 ta belgi"),
  customerPhone: z.string().min(9, "Telefon raqam noto'g'ri"),
  address: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.number(),
    quantity: z.number().int().min(1),
  })).min(1, "Kamida 1 ta mahsulot kerak"),
});

export const marketplaceOrderRouter = router({
  // Public: create order from marketplace
  create: publicProcedure
    .input(createOrderSchema)
    .mutation(async ({ ctx, input }) => {
      // Fetch products to get prices
      const productIds = input.items.map((i) => i.productId);
      const products = await ctx.db.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, name: true, sellPriceUzs: true },
      });

      if (products.length !== productIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ba'zi mahsulotlar topilmadi" });
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      const items = input.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const priceUzs = Number(product.sellPriceUzs);
        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          priceUzs: product.sellPriceUzs,
          totalUzs: priceUzs * item.quantity,
        };
      });

      const totalUzs = items.reduce((sum, i) => sum + i.totalUzs, 0);

      const order = await ctx.db.marketplaceOrder.create({
        data: {
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          address: input.address ?? null,
          notes: input.notes ?? null,
          totalUzs,
          items: { create: items },
        },
        include: { items: true },
      });

      // Notify admin via socket
      ctx.io?.to("room:sales").emit("marketplace:order", {
        id: order.id,
        customerName: order.customerName,
        totalUzs: Number(order.totalUzs),
      });

      return { id: order.id };
    }),

  // Public: check order status
  status: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.marketplaceOrder.findUnique({
        where: { id: input.id },
        include: { items: true },
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Buyurtma topilmadi" });
      return order;
    }),

  // Admin: list all orders
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.marketplaceOrder.findMany({
        where: input?.status ? { status: input.status } : {},
        include: { items: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Banner-product links (stored in CompanyInfo as JSON)
  getBannerLinks: publicProcedure
    .query(async ({ ctx }) => {
      const row = await ctx.db.companyInfo.findUnique({ where: { key: "bannerLinks" } });
      if (!row?.value) return {};
      try {
        return JSON.parse(row.value) as Record<string, number>;
      } catch {
        return {};
      }
    }),

  setBannerLink: protectedProcedure
    .input(z.object({
      bannerName: z.string(),
      productId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.companyInfo.findUnique({ where: { key: "bannerLinks" } });
      let links: Record<string, number | null> = {};
      if (row?.value) {
        try { links = JSON.parse(row.value); } catch { /* ignore */ }
      }

      if (input.productId === null) {
        delete links[input.bannerName];
      } else {
        links[input.bannerName] = input.productId;
      }

      await ctx.db.companyInfo.upsert({
        where: { key: "bannerLinks" },
        update: { value: JSON.stringify(links) },
        create: { key: "bannerLinks", value: JSON.stringify(links) },
      });

      return { success: true };
    }),

  // Admin: update status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["CONFIRMED", "CANCELLED"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.marketplaceOrder.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),
});
