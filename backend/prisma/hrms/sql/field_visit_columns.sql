ALTER TABLE "TaskProject" ADD COLUMN IF NOT EXISTS "siteLatitude" VARCHAR(64);
ALTER TABLE "TaskProject" ADD COLUMN IF NOT EXISTS "siteLongitude" VARCHAR(64);
ALTER TABLE "TaskProject" ADD COLUMN IF NOT EXISTS "daySignOutSelfieRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "enplAssignmentId" INTEGER;
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "visitSequence" INTEGER;
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "scheduledArrival" TIMESTAMP(3);
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "visitDate" TIMESTAMP(3);
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "allowedRadiusMeters" INTEGER;
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "graceMinutes" INTEGER;
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "visitDurationMinutes" INTEGER;
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "visitLatitude" VARCHAR(64);
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "visitLongitude" VARCHAR(64);
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "complianceStatus" VARCHAR(32);
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "exceptionStatus" VARCHAR(64);
ALTER TABLE "TaskEngineerAssignment" ADD COLUMN IF NOT EXISTS "signOutForTheDay" BOOLEAN;
