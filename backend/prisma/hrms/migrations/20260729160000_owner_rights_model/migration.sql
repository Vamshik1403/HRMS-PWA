-- AlterTable
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "legalEntityType" VARCHAR;

-- AlterTable
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "isCompanyOwner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "ownerTitle" VARCHAR;

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_module_permissions" (
    "id" SERIAL NOT NULL,
    "companyID" INTEGER NOT NULL,
    "manageEmployeeID" INTEGER NOT NULL,
    "moduleKey" VARCHAR(64) NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_module_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_module_permissions_companyID_manageEmployeeID_moduleKey_key"
  ON "employee_module_permissions"("companyID", "manageEmployeeID", "moduleKey");

CREATE INDEX IF NOT EXISTS "employee_module_permissions_manageEmployeeID_idx"
  ON "employee_module_permissions"("manageEmployeeID");

CREATE INDEX IF NOT EXISTS "employee_module_permissions_companyID_idx"
  ON "employee_module_permissions"("companyID");

DO $$ BEGIN
  ALTER TABLE "employee_module_permissions"
    ADD CONSTRAINT "employee_module_permissions_companyID_fkey"
    FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employee_module_permissions"
    ADD CONSTRAINT "employee_module_permissions_manageEmployeeID_fkey"
    FOREIGN KEY ("manageEmployeeID") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
