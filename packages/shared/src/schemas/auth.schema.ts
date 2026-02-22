import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Foydalanuvchi nomini kiriting"),
  password: z.string().min(1, "Parolni kiriting"),
});

export const setExchangeRateSchema = z.object({
  rate: z.number().positive("Kurs musbat bo'lishi kerak"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4, "Parol kamida 4 ta belgidan iborat bo'lishi kerak"),
});

export const createUserSchema = z.object({
  username: z.string().min(3, "Kamida 3 belgi").max(30),
  password: z.string().min(4, "Kamida 4 belgi"),
  fullName: z.string().min(2, "Kamida 2 belgi"),
  role: z.enum(["CASHIER_SALES", "CASHIER_SERVICE", "MASTER"]),
  phone: z.string().optional(),
  baseSalaryUzs: z.number().nonnegative().default(0),
  bonusPerJob: z.number().nonnegative().default(0),
  customPermissions: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  id: z.number(),
  fullName: z.string().min(2).optional(),
  role: z.enum(["CASHIER_SALES", "CASHIER_SERVICE", "MASTER"]).optional(),
  phone: z.string().nullable().optional(),
  baseSalaryUzs: z.number().nonnegative().optional(),
  bonusPerJob: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
  customPermissions: z.array(z.string()).nullable().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetExchangeRateInput = z.infer<typeof setExchangeRateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
