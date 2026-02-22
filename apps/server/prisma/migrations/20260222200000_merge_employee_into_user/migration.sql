-- AlterTable: Add employee fields to User
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "baseSalaryUzs" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "bonusPerJob" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Migrate Advance: employeeId -> userId
ALTER TABLE "Advance" ADD COLUMN "userId" INTEGER;

-- Try to map existing advances to users (by matching Employee.fullName to User.fullName)
UPDATE "Advance" a
SET "userId" = u.id
FROM "Employee" e
JOIN "User" u ON u."fullName" = e."fullName"
WHERE a."employeeId" = e.id;

-- For any unmapped advances, assign to first BOSS user
UPDATE "Advance"
SET "userId" = (SELECT id FROM "User" WHERE role = 'BOSS' ORDER BY id LIMIT 1)
WHERE "userId" IS NULL;

-- Make userId NOT NULL and add FK
ALTER TABLE "Advance" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old FK and column
ALTER TABLE "Advance" DROP CONSTRAINT IF EXISTS "Advance_employeeId_fkey";
ALTER TABLE "Advance" DROP COLUMN "employeeId";

-- Migrate JobRecord: employeeId -> userId
ALTER TABLE "JobRecord" ADD COLUMN "userId" INTEGER;

UPDATE "JobRecord" j
SET "userId" = u.id
FROM "Employee" e
JOIN "User" u ON u."fullName" = e."fullName"
WHERE j."employeeId" = e.id;

UPDATE "JobRecord"
SET "userId" = (SELECT id FROM "User" WHERE role = 'BOSS' ORDER BY id LIMIT 1)
WHERE "userId" IS NULL;

ALTER TABLE "JobRecord" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "JobRecord" ADD CONSTRAINT "JobRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JobRecord" DROP CONSTRAINT IF EXISTS "JobRecord_employeeId_fkey";
ALTER TABLE "JobRecord" DROP COLUMN "employeeId";

-- Migrate SalaryPayment: employeeId -> userId
ALTER TABLE "SalaryPayment" ADD COLUMN "userId" INTEGER;

UPDATE "SalaryPayment" s
SET "userId" = u.id
FROM "Employee" e
JOIN "User" u ON u."fullName" = e."fullName"
WHERE s."employeeId" = e.id;

UPDATE "SalaryPayment"
SET "userId" = (SELECT id FROM "User" WHERE role = 'BOSS' ORDER BY id LIMIT 1)
WHERE "userId" IS NULL;

ALTER TABLE "SalaryPayment" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old unique and FK
ALTER TABLE "SalaryPayment" DROP CONSTRAINT IF EXISTS "SalaryPayment_employeeId_fkey";
ALTER TABLE "SalaryPayment" DROP CONSTRAINT IF EXISTS "SalaryPayment_employeeId_month_year_key";
ALTER TABLE "SalaryPayment" DROP COLUMN "employeeId";

-- Add new unique constraint
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_userId_month_year_key" UNIQUE ("userId", "month", "year");

-- Copy employee data to matching users (baseSalaryUzs, bonusPerJob, phone)
UPDATE "User" u
SET
  "baseSalaryUzs" = e."baseSalaryUzs",
  "bonusPerJob" = e."bonusPerJob",
  "phone" = e."phone"
FROM "Employee" e
WHERE u."fullName" = e."fullName";

-- Drop Employee table
DROP TABLE "Employee";
