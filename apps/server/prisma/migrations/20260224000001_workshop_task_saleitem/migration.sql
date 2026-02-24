-- AlterTable: add saleItemId to WorkshopTask
ALTER TABLE "WorkshopTask" ADD COLUMN "saleItemId" INTEGER;

-- CreateIndex: unique constraint on saleItemId
CREATE UNIQUE INDEX "WorkshopTask_saleItemId_key" ON "WorkshopTask"("saleItemId");

-- AddForeignKey
ALTER TABLE "WorkshopTask" ADD CONSTRAINT "WorkshopTask_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
