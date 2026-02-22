import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { setExchangeRateSchema } from "@ezoz/shared";

export const currencyRouter = router({
  getToday: publicProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rate = await ctx.db.exchangeRate.findUnique({
      where: { date: today },
    });

    return rate ? Number(rate.rate) : null;
  }),

  setRate: protectedProcedure
    .input(setExchangeRateSchema)
    .mutation(async ({ ctx, input }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rate = await ctx.db.exchangeRate.upsert({
        where: { date: today },
        update: { rate: input.rate, setById: ctx.user.userId },
        create: { rate: input.rate, date: today, setById: ctx.user.userId },
      });

      // Broadcast to all clients
      ctx.io?.emit("currency:rateChanged", { rate: Number(rate.rate) });

      return Number(rate.rate);
    }),

  fetchCbuRate: publicProcedure.query(async () => {
    try {
      const res = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/");
      if (!res.ok) return null;
      const data = await res.json() as Array<{ Ccy: string; Rate: string }>;
      const usd = data.find((item) => item.Ccy === "USD");
      return usd ? Number(usd.Rate) : null;
    } catch {
      return null;
    }
  }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const rates = await ctx.db.exchangeRate.findMany({
      orderBy: { date: "desc" },
      take: 30,
    });
    return rates.map((r) => ({ ...r, rate: Number(r.rate) }));
  }),
});
