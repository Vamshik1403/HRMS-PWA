-- Mutual text-code company linking for task assignee picker only.
CREATE TABLE IF NOT EXISTS "CompanyFederalDomain" (
  "id" SERIAL PRIMARY KEY,
  "companyID" INTEGER NOT NULL,
  "code" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyFederalDomain_companyID_code_key"
  ON "CompanyFederalDomain"("companyID", "code");

CREATE INDEX IF NOT EXISTS "CompanyFederalDomain_code_idx"
  ON "CompanyFederalDomain"("code");

CREATE INDEX IF NOT EXISTS "CompanyFederalDomain_companyID_idx"
  ON "CompanyFederalDomain"("companyID");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CompanyFederalDomain_companyID_fkey'
  ) THEN
    ALTER TABLE "CompanyFederalDomain"
      ADD CONSTRAINT "CompanyFederalDomain_companyID_fkey"
      FOREIGN KEY ("companyID") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
