import { z } from "zod";

export const createExpenseSchema = z.object({
  categoryId: z.number(),
  amountUzs: z.number().positive("Summa musbat bo'lishi kerak"),
  amountUsd: z.number().nonnegative().default(0),
  description: z.string().min(1, "Izoh kiriting"),
  cashRegister: z.enum(["SALES", "SERVICE"]),
  paymentType: z.enum(["CASH_UZS", "CASH_USD", "CARD", "TRANSFER"]).default("CASH_UZS"),
});

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1, "Toifa nomini kiriting"),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
