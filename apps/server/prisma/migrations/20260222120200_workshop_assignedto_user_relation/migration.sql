/*
  Warnings:

  - You are about to drop the column `assignedTo` on the `WorkshopTask` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WorkshopTask" DROP COLUMN "assignedTo",
ADD COLUMN     "assignedToId" INTEGER;

-- AddForeignKey
ALTER TABLE "WorkshopTask" ADD CONSTRAINT "WorkshopTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
