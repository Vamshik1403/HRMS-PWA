-- AMC flag for ENPL employee sync. Existing employees default to false.
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "amc" BOOLEAN NOT NULL DEFAULT false;
