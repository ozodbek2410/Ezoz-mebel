import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Mahsulot nomini kiriting"),
  sku: z.string().optional(),
  categoryId: z.number(),
  unit: z.enum(["DONA", "M2", "METR", "LIST", "KG"]).default("DONA"),
  sellPriceUzs: z.number().nonnegative(),
  sellPriceUsd: z.number().nonnegative(),
  minPriceUzs: z.number().nonnegative(),
  minPriceUsd: z.number().nonnegative(),
  costPriceUzs: z.number().nonnegative(),
  costPriceUsd: z.number().nonnegative(),
  vatPercent: z.number().default(12),
  ikpuCode: z.string().optional(),
  packageCode: z.string().optional(),
  minStockAlert: z.number().nonnegative().default(0),
  description: z.string().optional(),
  isLocked: z.boolean().default(false),
  isMarketplaceVisible: z.boolean().default(false),
  showPrice: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.number(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Guruh nomini kiriting"),
  parentId: z.number().nullable().default(null),
  sortOrder: z.number().default(0),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
