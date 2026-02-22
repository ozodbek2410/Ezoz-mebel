import { z } from "zod";

export const createAdvanceSchema = z.object({
  userId: z.number(),
  amountUzs: z.number().positive("Summa musbat bo'lishi kerak"),
  cashRegister: z.enum(["SALES", "SERVICE"]),
  notes: z.string().optional(),
});

export const createJobRecordSchema = z.object({
  userId: z.number(),
  description: z.string().min(1),
  bonusUzs: z.number().nonnegative(),
});

export type CreateAdvanceInput = z.infer<typeof createAdvanceSchema>;
export type CreateJobRecordInput = z.infer<typeof createJobRecordSchema>;
