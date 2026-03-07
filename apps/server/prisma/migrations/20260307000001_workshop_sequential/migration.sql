-- AlterTable: remove saleItemId and add stepOrder to WorkshopTask
ALTER TABLE "WorkshopTask" DROP COLUMN IF EXISTS "saleItemId";
ALTER TABLE "WorkshopTask" ADD COLUMN IF NOT EXISTS "stepOrder" INTEGER NOT NULL DEFAULT 1;
