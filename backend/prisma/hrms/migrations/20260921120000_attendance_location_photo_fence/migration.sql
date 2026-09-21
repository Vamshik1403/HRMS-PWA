-- Additive only: store PWA punch selfie and the fence used for that session.
ALTER TABLE "attendance_locations" ADD COLUMN IF NOT EXISTS "photoUrl" VARCHAR(512);
ALTER TABLE "attendance_locations" ADD COLUMN IF NOT EXISTS "fenceType" VARCHAR(16);
ALTER TABLE "attendance_locations" ADD COLUMN IF NOT EXISTS "fenceSiteId" INTEGER;
