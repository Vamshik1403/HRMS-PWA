-- Designations no longer link to a Department (unlinked per product decision).
ALTER TABLE "Designations" DROP CONSTRAINT IF EXISTS "Designations_departmentID_fkey";
ALTER TABLE "Designations" DROP COLUMN IF EXISTS "departmentID";
