-- Link ManageEmployee to the Payroll Salary Cycle master (not weekly-off text).
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "salaryCycleID" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ManageEmployee_salaryCycleID_fkey'
  ) THEN
    ALTER TABLE "ManageEmployee"
      ADD CONSTRAINT "ManageEmployee_salaryCycleID_fkey"
      FOREIGN KEY ("salaryCycleID") REFERENCES "SalaryCycle"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;
