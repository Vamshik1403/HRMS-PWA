-- AlterTable: make employeeID nullable and add employeeIDs array
ALTER TABLE "EmployeeMemo" ALTER COLUMN "employeeID" DROP NOT NULL;
ALTER TABLE "EmployeeMemo" ADD COLUMN "employeeIDs" INTEGER[] NOT NULL DEFAULT '{}';

-- Drop old cascade FK, add new SetNull FK
ALTER TABLE "EmployeeMemo" DROP CONSTRAINT IF EXISTS "EmployeeMemo_employeeID_fkey";
ALTER TABLE "EmployeeMemo" ADD CONSTRAINT "EmployeeMemo_employeeID_fkey"
  FOREIGN KEY ("employeeID") REFERENCES "ManageEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
