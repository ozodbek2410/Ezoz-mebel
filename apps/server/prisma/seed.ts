import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

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

  // Create default product categories
  const mdfCategory = await prisma.category.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "MDF LAR", sortOrder: 1 },
  });

  await prisma.category.createMany({
    data: [
      { name: "LAMINAT", parentId: mdfCategory.id, sortOrder: 1 },
      { name: "DVP", parentId: mdfCategory.id, sortOrder: 2 },
      { name: "MDF GOLI", parentId: mdfCategory.id, sortOrder: 3 },
      { name: "KASHTAN", sortOrder: 2 },
      { name: "STOLESHNITSA", sortOrder: 3 },
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
    create: { rate: 12800, date: today, setById: 1 },
  });

  // Demo products for marketplace
  const allCategories = await prisma.category.findMany();
  const mdf = allCategories.find((c) => c.name === "MDF LAR");
  const laminat = allCategories.find((c) => c.name === "LAMINAT");
  const dvp = allCategories.find((c) => c.name === "DVP");
  const kashtan = allCategories.find((c) => c.name === "KASHTAN");
  const stoleshnitsa = allCategories.find((c) => c.name === "STOLESHNITSA");

  const existingProducts = await prisma.product.count();
  if (existingProducts === 0) {
    const demoProducts = [
      { code: "MDF-001", name: "MDF 2800x2070 Oq (18mm)", categoryId: mdf!.id, sellPriceUzs: 320000, sellPriceUsd: 25, costPriceUzs: 240000, costPriceUsd: 18.75, description: "Yuqori sifatli oq MDF list. O'lchami 2800x2070mm, qalinligi 18mm." },
      { code: "MDF-002", name: "MDF 2800x2070 Beige (18mm)", categoryId: mdf!.id, sellPriceUzs: 340000, sellPriceUsd: 26.5, costPriceUzs: 255000, costPriceUsd: 19.9, description: "Beige rangli MDF list. Oshxona va yotoqxona mebeli uchun ideal." },
      { code: "MDF-003", name: "MDF 2800x2070 Wenge (18mm)", categoryId: mdf!.id, sellPriceUzs: 360000, sellPriceUsd: 28, costPriceUzs: 270000, costPriceUsd: 21, description: "Wenge rang. Premium sifat, chizilishga chidamli." },
      { code: "MDF-004", name: "MDF 2800x2070 Sanobar (10mm)", categoryId: mdf!.id, sellPriceUzs: 250000, sellPriceUsd: 19.5, costPriceUzs: 187000, costPriceUsd: 14.6, description: "Sanobar yog'och teksturali MDF. 10mm qalinlik." },
      { code: "MDF-005", name: "MDF 2800x2070 Kulrang (16mm)", categoryId: mdf!.id, sellPriceUzs: 310000, sellPriceUsd: 24, costPriceUzs: 232000, costPriceUsd: 18.1, description: "Zamonaviy kulrang tus. Ofis mebeli uchun mos." },
      { code: "LMN-001", name: "Laminat Oq Glyanets (8mm)", categoryId: laminat!.id, sellPriceUzs: 180000, sellPriceUsd: 14, costPriceUzs: 135000, costPriceUsd: 10.5, description: "Glyanets sirtli oq laminat. Chiroyli va amaliy." },
      { code: "LMN-002", name: "Laminat Dub Sonoma (8mm)", categoryId: laminat!.id, sellPriceUzs: 195000, sellPriceUsd: 15.2, costPriceUzs: 146000, costPriceUsd: 11.4, description: "Dub Sonoma dekorli laminat. Eng mashhur rang." },
      { code: "LMN-003", name: "Laminat Yong'oq (10mm)", categoryId: laminat!.id, sellPriceUzs: 220000, sellPriceUsd: 17, costPriceUzs: 165000, costPriceUsd: 12.9, description: "Tabiiy yong'oq yog'och ko'rinishi. 10mm qalinlik." },
      { code: "DVP-001", name: "DVP 2745x1700 (3.2mm)", categoryId: dvp!.id, sellPriceUzs: 85000, sellPriceUsd: 6.6, costPriceUzs: 63000, costPriceUsd: 4.9, description: "Standart DVP list. Mebel orqa devorlari uchun." },
      { code: "DVP-002", name: "DVP 2745x1700 Laminat (3.2mm)", categoryId: dvp!.id, sellPriceUzs: 120000, sellPriceUsd: 9.4, costPriceUzs: 90000, costPriceUsd: 7, description: "Laminatlangan DVP. Oq sirt, mebel uchun." },
      { code: "KSH-001", name: "Kashtan 2800x600 (18mm)", categoryId: kashtan!.id, sellPriceUzs: 280000, sellPriceUsd: 21.9, costPriceUzs: 210000, costPriceUsd: 16.4, description: "Kashtan rangli panel. Oshxona shkafi uchun." },
      { code: "KSH-002", name: "Kashtan 2800x600 (28mm)", categoryId: kashtan!.id, sellPriceUzs: 380000, sellPriceUsd: 29.7, costPriceUzs: 285000, costPriceUsd: 22.3, description: "Qalin kashtan panel. Yuqori mustahkamlik." },
      { code: "STL-001", name: "Stoleshnitsa Oq Marmor (28mm)", categoryId: stoleshnitsa!.id, sellPriceUzs: 450000, sellPriceUsd: 35.2, costPriceUzs: 337000, costPriceUsd: 26.3, description: "Oq marmor ko'rinishli stoleshnitsa. Oshxona uchun ideal." },
      { code: "STL-002", name: "Stoleshnitsa Dub (38mm)", categoryId: stoleshnitsa!.id, sellPriceUzs: 520000, sellPriceUsd: 40.6, costPriceUzs: 390000, costPriceUsd: 30.5, description: "Dub yog'ochi ko'rinishli stoleshnitsa. Premium sifat." },
      { code: "STL-003", name: "Stoleshnitsa Granit Qora (28mm)", categoryId: stoleshnitsa!.id, sellPriceUzs: 480000, sellPriceUsd: 37.5, costPriceUzs: 360000, costPriceUsd: 28.1, description: "Qora granit teksturali. Zamonaviy oshxona uchun." },
      { code: "MDF-006", name: "MDF Gloss Oq (18mm)", categoryId: mdf!.id, sellPriceUzs: 420000, sellPriceUsd: 32.8, costPriceUzs: 315000, costPriceUsd: 24.6, description: "Yuqori glyanets oq MDF. Premium mebel uchun." },
      { code: "LMN-004", name: "Laminat Antrasit (12mm)", categoryId: laminat!.id, sellPriceUzs: 260000, sellPriceUsd: 20.3, costPriceUzs: 195000, costPriceUsd: 15.2, description: "To'q kulrang antrasit laminat. Zamonaviy uslub." },
      { code: "MDF-007", name: "MDF 2800x2070 Olcha (18mm)", categoryId: mdf!.id, sellPriceUzs: 350000, sellPriceUsd: 27.3, costPriceUzs: 262000, costPriceUsd: 20.5, description: "Olcha rangli MDF. Klassik mebel uchun." },
      { code: "KSH-003", name: "Kashtan 2800x300 (18mm)", categoryId: kashtan!.id, sellPriceUzs: 180000, sellPriceUsd: 14.1, costPriceUzs: 135000, costPriceUsd: 10.5, description: "Tor kashtan panel. Tokchalar va javonlar uchun." },
      { code: "STL-004", name: "Stoleshnitsa Oq (28mm)", categoryId: stoleshnitsa!.id, sellPriceUzs: 390000, sellPriceUsd: 30.5, costPriceUzs: 292000, costPriceUsd: 22.8, description: "Oddiy oq stoleshnitsa. Universal foydalanish." },
    ];

    const warehouse = await prisma.warehouse.findFirst({ where: { name: "Asosiy ombor" } });

    for (const p of demoProducts) {
      const product = await prisma.product.create({
        data: {
          code: p.code,
          name: p.name,
          categoryId: p.categoryId,
          sellPriceUzs: p.sellPriceUzs,
          sellPriceUsd: p.sellPriceUsd,
          minPriceUzs: Math.round(p.sellPriceUzs * 0.85),
          minPriceUsd: Math.round(p.sellPriceUsd * 0.85 * 100) / 100,
          costPriceUzs: p.costPriceUzs,
          costPriceUsd: p.costPriceUsd,
          description: p.description,
          isActive: true,
          isMarketplaceVisible: true,
          showPrice: true,
        },
      });

      // Add stock
      if (warehouse) {
        await prisma.stockItem.create({
          data: {
            productId: product.id,
            warehouseId: warehouse.id,
            quantity: Math.floor(Math.random() * 50) + 10,
          },
        });
      }
    }

    console.log(`Created ${demoProducts.length} demo products`);
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
