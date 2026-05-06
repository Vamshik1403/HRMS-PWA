-- Drop orphaned columns that existed in DB but not in schema
ALTER TABLE "WorkShift" DROP COLUMN IF EXISTS "hasFactualShift";
ALTER TABLE "WorkShift" DROP COLUMN IF EXISTS "factualScheduleJson";
ALTER TABLE "AttendancePolicy" DROP COLUMN IF EXISTS "hasFactualPolicy";
ALTER TABLE "AttendancePolicy" DROP COLUMN IF EXISTS "factualPolicyJson";
