-- Additive only: per-employee photo+radius opt-in and work-from-home fence.
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "photoPunchEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "wfhAllowed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "wfhHomeAddress" TEXT;
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "wfhHomeLatitude" DOUBLE PRECISION;
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "wfhHomeLongitude" DOUBLE PRECISION;
