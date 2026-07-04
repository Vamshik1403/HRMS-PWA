-- Add missing tables required by company modules and contractor branch mapping

CREATE TABLE IF NOT EXISTS "Module" (
    "id" SERIAL NOT NULL,
    "moduleKey" VARCHAR(100) NOT NULL,
    "moduleName" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Module_moduleKey_key" ON "Module"("moduleKey");

CREATE TABLE IF NOT EXISTS "CompanyModule" (
    "id" SERIAL NOT NULL,
    "companyID" INTEGER NOT NULL,
    "moduleID" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyModule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompanyModule_companyID_idx" ON "CompanyModule"("companyID");
CREATE INDEX IF NOT EXISTS "CompanyModule_moduleID_idx" ON "CompanyModule"("moduleID");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyModule_companyID_moduleID_key" ON "CompanyModule"("companyID", "moduleID");

DO $$ BEGIN
  ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_moduleID_fkey" FOREIGN KEY ("moduleID") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ContractorBranch" (
    "id" SERIAL NOT NULL,
    "contractorID" INTEGER NOT NULL,
    "branchID" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractorBranch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContractorBranch_contractorID_idx" ON "ContractorBranch"("contractorID");
CREATE INDEX IF NOT EXISTS "ContractorBranch_branchID_idx" ON "ContractorBranch"("branchID");
CREATE UNIQUE INDEX IF NOT EXISTS "ContractorBranch_contractorID_branchID_key" ON "ContractorBranch"("contractorID", "branchID");

DO $$ BEGIN
  ALTER TABLE "ContractorBranch" ADD CONSTRAINT "ContractorBranch_contractorID_fkey" FOREIGN KEY ("contractorID") REFERENCES "Contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ContractorBranch" ADD CONSTRAINT "ContractorBranch_branchID_fkey" FOREIGN KEY ("branchID") REFERENCES "Branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
