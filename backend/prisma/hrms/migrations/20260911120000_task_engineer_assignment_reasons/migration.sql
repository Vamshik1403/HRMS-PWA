-- Additive only: store ENPL reschedule/manager reasons on existing assignment rows.
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "rescheduleReason" TEXT;
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "managerReason" TEXT;
