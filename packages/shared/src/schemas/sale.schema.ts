import { z } from "zod";

export const SaleType = {
  PRODUCT: "PRODUCT",
  SERVICE: "SERVICE",
} as const;

export const SaleStatus = {
  OPEN: "OPEN",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  RETURNED: "RETURNED",
} as const;

export const PaymentType = {
  CASH_UZS: "CASH_UZS",
  CASH_USD: "CASH_USD",
  CARD: "CARD",
  TRANSFER: "TRANSFER",
  DEBT: "DEBT",
} as const;

export const CashRegisterType = {
  SALES: "SALES",
  SERVICE: "SERVICE",
} as const;

export const createSaleSchema = z.object({
  customerId: z.number().optional(),
  warehouseId: z.number().optional(),
  saleType: z.enum(["PRODUCT", "SERVICE"]),
  goesToWorkshop: z.boolean().default(false),
  assignedToId: z.number().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.number().optional(),
    serviceName: z.string().optional(),
    quantity: z.number().positive("Miqdor musbat bo'lishi kerak"),
    priceUzs: z.number().nonnegative(),
    priceUsd: z.number().nonnegative(),
  })).min(1, "Kamida 1 ta mahsulot qo'shing"),
});

export const createPaymentSchema = z.object({
  saleId: z.number().optional(),
  customerId: z.number().optional(),
  amountUzs: z.number().nonnegative(),
  amountUsd: z.number().nonnegative(),
  paymentType: z.enum(["CASH_UZS", "CASH_USD", "CARD", "TRANSFER", "DEBT"]),
  source: z.enum(["NEW_SALE", "OLD_DEBT"]).default("NEW_SALE"),
  notes: z.string().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
