-- Add numberOfChildren to ManageEmployee for maternity leave duration calculation
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "numberOfChildren" INTEGER;
