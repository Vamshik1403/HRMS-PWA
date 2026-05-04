-- Add childNumber and birthEventDate to leaveApplication for event-based maternity/paternity tracking
ALTER TABLE "leaveApplication" ADD COLUMN IF NOT EXISTS "childNumber" VARCHAR;
ALTER TABLE "leaveApplication" ADD COLUMN IF NOT EXISTS "birthEventDate" VARCHAR;
