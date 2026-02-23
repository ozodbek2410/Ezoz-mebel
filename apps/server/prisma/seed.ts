import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { CATEGORIES, ROOT_PRODUCTS } from "./seed-products";
import type { RawProduct } from "./seed-products";

const prisma = new PrismaClient();
const RATE = 12800; // Default exchange rate UZS per 1 USD

function toUsd(uzs: number): number {
  if (uzs <= 0) return 0;
  return Math.round((uzs / RATE) * 100) / 100;
}

function toUzs(usd: number): number {
  if (usd <= 0) return 0;
  return Math.round(usd * RATE);
}

async function seedProducts(warehouseId: number) {
  const existingCount = await prisma.product.count();
  if (existingCount > 0) {
    console.log(`Products already exist (${existingCount}), skipping product seed`);
    return;
  }

  // Create "UMUMIY" root category for root-level products
  const rootCat = await prisma.category.create({
    data: { name: "UMUMIY", sortOrder: 0 },
  });

  // Create all categories
  const categoryMap = new Map<string, number>();
  categoryMap.set("UMUMIY", rootCat.id);

  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({
      data: { name: cat.name, sortOrder: cat.sortOrder },
    });
    categoryMap.set(cat.name, created.id);
  }

  // Seed root products
  await seedProductBatch(ROOT_PRODUCTS, rootCat.id, warehouseId);
  console.log(`Seeded ${ROOT_PRODUCTS.length} root products`);

  // Seed category products
  for (const cat of CATEGORIES) {
    const catId = categoryMap.get(cat.name);
    if (!catId) continue;
    await seedProductBatch(cat.products, catId, warehouseId);
    console.log(`Seeded ${cat.products.length} products in ${cat.name}`);
  }
}

async function seedProductBatch(products: RawProduct[], categoryId: number, warehouseId: number) {
  const seenCodes = new Set<string>();

  for (const raw of products) {
    // Skip duplicate codes within batch
    if (seenCodes.has(raw.code)) {
      console.log(`  Skipping duplicate code: ${raw.code} (${raw.name})`);
      continue;
    }
    seenCodes.add(raw.code);

    // Calculate prices — costUsd is in USD, sellUzs is in UZS
    const costPriceUsd = raw.costUsd;
    const costPriceUzs = toUzs(costPriceUsd);
    const sellPriceUzs = raw.sellUzs;
    const sellPriceUsd = toUsd(sellPriceUzs);
    const minPriceUzs = Math.round(sellPriceUzs * 0.85);
    const minPriceUsd = Math.round(sellPriceUsd * 0.85 * 100) / 100;

    try {
      const product = await prisma.product.create({
        data: {
          code: raw.code,
          name: raw.name,
          categoryId,
          unit: raw.unit,
          sellPriceUzs,
          sellPriceUsd,
          minPriceUzs,
          minPriceUsd,
          costPriceUzs,
          costPriceUsd,
          isActive: true,
          isMarketplaceVisible: false,
          showPrice: true,
        },
      });

      // Add stock if quantity > 0
      if (raw.qty > 0) {
        await prisma.stockItem.create({
          data: {
            productId: product.id,
            warehouseId,
            quantity: raw.qty,
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unique constraint")) {
        console.log(`  Skipping duplicate code: ${raw.code} (${raw.name})`);
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  // Create users
  const passwordHash = await bcrypt.hash("1234", 10);

  await prisma.user.createMany({
    data: [
      { username: "boshliq", passwordHash, fullName: "Boshliq", role: "BOSS" },
      { username: "kassir1", passwordHash, fullName: "Kassir-Savdo", role: "CASHIER_SALES" },
      { username: "kassir2", passwordHash, fullName: "Kassir-Xizmat", role: "CASHIER_SERVICE" },
      { username: "aziz", passwordHash, fullName: "AZIZ", role: "MASTER" },
      { username: "mirzo", passwordHash, fullName: "MIRZO", role: "MASTER" },
    ],
    skipDuplicates: true,
  });

  // Create warehouses
  await prisma.warehouse.createMany({
    data: [
      { name: "Asosiy ombor" },
      { name: "Sex" },
    ],
    skipDuplicates: true,
  });

  // Create service types
  await prisma.serviceType.createMany({
    data: [
      { name: "Kesish", sortOrder: 1 },
      { name: "Kromka yopish", sortOrder: 2 },
      { name: "Rover", sortOrder: 3 },
      { name: "Frezerlash", sortOrder: 4 },
      { name: "Yig'ish", sortOrder: 5 },
    ],
    skipDuplicates: true,
  });

  // Create expense categories
  await prisma.expenseCategory.createMany({
    data: [
      { name: "Ijara" },
      { name: "Kommunal xizmatlar" },
      { name: "Xodim xarajatlari" },
      { name: "Transport" },
      { name: "Xo'jalik mollari" },
      { name: "Reklama" },
      { name: "Ta'mir va jihozlar" },
      { name: "Boshqa" },
    ],
    skipDuplicates: true,
  });

  // Create company info
  await prisma.companyInfo.createMany({
    data: [
      { key: "name", value: "EZOZ MEBEL" },
      { key: "phone", value: "" },
      { key: "address", value: "" },
      { key: "workHours", value: "09:00 - 18:00" },
    ],
    skipDuplicates: true,
  });

  // Set default exchange rate
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.exchangeRate.upsert({
    where: { date: today },
    update: {},
    create: { rate: RATE, date: today, setById: 1 },
  });

  // Seed products
  const warehouse = await prisma.warehouse.findFirst({ where: { name: "Asosiy ombor" } });
  if (warehouse) {
    await seedProducts(warehouse.id);
  }

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
