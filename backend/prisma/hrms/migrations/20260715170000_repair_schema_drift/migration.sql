-- Repair drift: columns/tables present in Prisma schema but missing from DB.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contactNo" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contractorID" INTEGER;

CREATE TABLE IF NOT EXISTS "EmailTemplate" (
  "id" SERIAL NOT NULL,
  "companyID" INTEGER,
  "eventType" VARCHAR NOT NULL,
  "subject" VARCHAR NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_companyID_eventType_key" ON "EmailTemplate"("companyID", "eventType");

CREATE TABLE IF NOT EXISTS "UserCompany" (
    "id" SERIAL NOT NULL,
    "userID" INTEGER NOT NULL,
    "companyID" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserCompany_userID_companyID_key" ON "UserCompany"("userID", "companyID");
CREATE INDEX IF NOT EXISTS "UserCompany_userID_idx" ON "UserCompany"("userID");
CREATE INDEX IF NOT EXISTS "UserCompany_companyID_idx" ON "UserCompany"("companyID");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserCompany_userID_fkey') THEN
    ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserCompany_companyID_fkey') THEN
    ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyID_fkey" FOREIGN KEY ("companyID") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_contractorID_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_contractorID_fkey" FOREIGN KEY ("contractorID") REFERENCES "Contractors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;
