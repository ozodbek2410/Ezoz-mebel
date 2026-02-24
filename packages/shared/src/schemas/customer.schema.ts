import { z } from "zod";

export const createCustomerSchema = z.object({
  fullName: z.string().min(1, "Ism-familiyani kiriting"),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  birthday: z.string().optional(),
  address: z.string().optional(),
  category: z.enum(["REGULAR", "MASTER"]).default("REGULAR"),
  initialDebtUzs: z.number().nonnegative().default(0),
  initialDebtUsd: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: z.number(),
});

export const searchCustomerSchema = z.object({
  query: z.string().default(""),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
