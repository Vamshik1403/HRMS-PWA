-- ENPL live-sync mapping + task contact designation (align with ENPL contact shape)

ALTER TABLE "TaskProjectContact"
  ADD COLUMN IF NOT EXISTS "designation" VARCHAR(128);

CREATE TABLE IF NOT EXISTS "EnplEntityMapping" (
  "id" SERIAL PRIMARY KEY,
  "companyID" INTEGER NOT NULL,
  "entityType" VARCHAR(32) NOT NULL,
  "hrmsId" INTEGER NOT NULL,
  "enplId" INTEGER,
  "enplCode" VARCHAR(128),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "EnplEntityMapping_entityType_hrmsId_key"
  ON "EnplEntityMapping"("entityType", "hrmsId");

CREATE UNIQUE INDEX IF NOT EXISTS "EnplEntityMapping_company_type_enplId_key"
  ON "EnplEntityMapping"("companyID", "entityType", "enplId")
  WHERE "enplId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "EnplEntityMapping_company_type_enplCode_idx"
  ON "EnplEntityMapping"("companyID", "entityType", "enplCode");

CREATE INDEX IF NOT EXISTS "EnplEntityMapping_companyID_idx"
  ON "EnplEntityMapping"("companyID");
