-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BOSS', 'CASHIER_SALES', 'CASHIER_SERVICE', 'MASTER');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CustomerCategory" AS ENUM ('REGULAR', 'MASTER');

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('DONA', 'M2', 'METR', 'LIST', 'KG');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'PAYMENT_PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WorkshopTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CASH_UZS', 'CASH_USD', 'CARD', 'TRANSFER', 'DEBT');

-- CreateEnum
CREATE TYPE "CashRegisterType" AS ENUM ('SALES', 'SERVICE');

-- CreateEnum
CREATE TYPE "CashOpType" AS ENUM ('SALE_INCOME', 'DEBT_PAYMENT', 'EXPENSE', 'SALARY_PAYMENT', 'ADVANCE_PAYMENT', 'WITHDRAWAL', 'DEPOSIT');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "exchangeRate" DECIMAL(18,2) NOT NULL,
    "openingBalanceUzs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "openingBalanceUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "closingBalanceUzs" DECIMAL(18,2),
    "closingBalanceUsd" DECIMAL(18,2),
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" SERIAL NOT NULL,
    "rate" DECIMAL(18,2) NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setById" INTEGER NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "phone2" TEXT,
    "birthday" DATE,
    "address" TEXT,
    "category" "CustomerCategory" NOT NULL DEFAULT 'REGULAR',
    "trustLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "initialDebtUzs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "initialDebtUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonusBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "categoryId" INTEGER NOT NULL,
    "unit" "ProductUnit" NOT NULL DEFAULT 'DONA',
    "sellPriceUzs" DECIMAL(18,2) NOT NULL,
    "sellPriceUsd" DECIMAL(18,2) NOT NULL,
    "minPriceUzs" DECIMAL(18,2) NOT NULL,
    "minPriceUsd" DECIMAL(18,2) NOT NULL,
    "costPriceUzs" DECIMAL(18,2) NOT NULL,
    "costPriceUsd" DECIMAL(18,2) NOT NULL,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "ikpuCode" TEXT,
    "packageCode" TEXT,
    "minStockAlert" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "description" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isMarketplaceVisible" BOOLEAN NOT NULL DEFAULT false,
    "showPrice" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" SERIAL NOT NULL,
    "documentNo" TEXT NOT NULL,
    "supplierId" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "totalUzs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "exchangeRate" DECIMAL(18,2) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" SERIAL NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "priceUzs" DECIMAL(18,2) NOT NULL,
    "priceUsd" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" SERIAL NOT NULL,
    "documentNo" TEXT NOT NULL,
    "fromWarehouseId" INTEGER NOT NULL,
    "toWarehouseId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCheck" (
    "id" SERIAL NOT NULL,
    "documentNo" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCheckItem" (
    "id" SERIAL NOT NULL,
    "inventoryCheckId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "expectedQty" DECIMAL(18,3) NOT NULL,
    "actualQty" DECIMAL(18,3) NOT NULL,
    "difference" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "InventoryCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revaluation" (
    "id" SERIAL NOT NULL,
    "documentNo" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "oldPriceUzs" DECIMAL(18,2) NOT NULL,
    "newPriceUzs" DECIMAL(18,2) NOT NULL,
    "oldPriceUsd" DECIMAL(18,2) NOT NULL,
    "newPriceUsd" DECIMAL(18,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "Revaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" SERIAL NOT NULL,
    "documentNo" TEXT NOT NULL,
    "customerId" INTEGER,
    "cashierId" INTEGER NOT NULL,
    "saleType" "SaleType" NOT NULL,
    "totalUzs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountUzs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "exchangeRate" DECIMAL(18,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'OPEN',
    "goesToWorkshop" BOOLEAN NOT NULL DEFAULT false,
    "workshopStatus" "WorkshopStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER,
    "serviceName" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "priceUzs" DECIMAL(18,2) NOT NULL,
    "priceUsd" DECIMAL(18,2) NOT NULL,
    "totalUzs" DECIMAL(18,2) NOT NULL,
    "totalUsd" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopTask" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "assignedTo" TEXT,
    "status" "WorkshopTaskStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "WorkshopTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopPhoto" (
    "id" SERIAL NOT NULL,
    "workshopTaskId" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER,
    "customerId" INTEGER,
    "amountUzs" DECIMAL(18,2) NOT NULL,
    "amountUsd" DECIMAL(18,2) NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "cashRegister" "CashRegisterType" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'NEW_SALE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegisterOp" (
    "id" SERIAL NOT NULL,
    "registerType" "CashRegisterType" NOT NULL,
    "operationType" "CashOpType" NOT NULL,
    "amountUzs" DECIMAL(18,2) NOT NULL,
    "amountUsd" DECIMAL(18,2) NOT NULL,
    "balanceAfterUzs" DECIMAL(18,2) NOT NULL,
    "balanceAfterUsd" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashRegisterOp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "printerSize" TEXT NOT NULL DEFAULT '80mm',
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reprintCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "amountUzs" DECIMAL(18,2) NOT NULL,
    "amountUsd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "cashRegister" "CashRegisterType" NOT NULL,
    "paymentType" "PaymentType" NOT NULL DEFAULT 'CASH_UZS',
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "baseSalaryUzs" DECIMAL(18,2) NOT NULL,
    "bonusPerJob" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "amountUzs" DECIMAL(18,2) NOT NULL,
    "cashRegister" "CashRegisterType" NOT NULL,
    "notes" TEXT,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRecord" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "bonusUzs" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryPayment" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" DECIMAL(18,2) NOT NULL,
    "totalBonus" DECIMAL(18,2) NOT NULL,
    "totalAdvance" DECIMAL(18,2) NOT NULL,
    "netPayment" DECIMAL(18,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableConfig" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tableName" TEXT NOT NULL,
    "columnConfig" TEXT NOT NULL,

    CONSTRAINT "TableConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInfo" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CompanyInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_date_key" ON "ExchangeRate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_productId_warehouseId_key" ON "StockItem"("productId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_documentNo_key" ON "Purchase"("documentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_documentNo_key" ON "Transfer"("documentNo");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCheck_documentNo_key" ON "InventoryCheck"("documentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Revaluation_documentNo_key" ON "Revaluation"("documentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_documentNo_key" ON "Sale"("documentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_saleId_key" ON "Receipt"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNo_key" ON "Receipt"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayment_employeeId_month_year_key" ON "SalaryPayment"("employeeId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TableConfig_userId_tableName_key" ON "TableConfig"("userId", "tableName");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInfo_key_key" ON "CompanyInfo"("key");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCheckItem" ADD CONSTRAINT "InventoryCheckItem_inventoryCheckId_fkey" FOREIGN KEY ("inventoryCheckId") REFERENCES "InventoryCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTask" ADD CONSTRAINT "WorkshopTask_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopPhoto" ADD CONSTRAINT "WorkshopPhoto_workshopTaskId_fkey" FOREIGN KEY ("workshopTaskId") REFERENCES "WorkshopTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterOp" ADD CONSTRAINT "CashRegisterOp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRecord" ADD CONSTRAINT "JobRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
