-- Restore employment status fields removed by a prior migration from another repo branch
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "employmentStatus" VARCHAR;
ALTER TABLE "EmpPromotion" ADD COLUMN IF NOT EXISTS "employmentStatus" VARCHAR;

CREATE TABLE IF NOT EXISTS "EmpEmploymentStatus" (
  "id" SERIAL NOT NULL,
  "manageEmployeeID" INTEGER NOT NULL,
  "employmentStatus" VARCHAR NOT NULL,
  "probationPeriod" VARCHAR,
  "effectFrom" VARCHAR,
  CONSTRAINT "EmpEmploymentStatus_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmpEmploymentStatus_manageEmployeeID_idx" ON "EmpEmploymentStatus"("manageEmployeeID");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmpEmploymentStatus_manageEmployeeID_fkey'
  ) THEN
    ALTER TABLE "EmpEmploymentStatus"
      ADD CONSTRAINT "EmpEmploymentStatus_manageEmployeeID_fkey"
      FOREIGN KEY ("manageEmployeeID") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
