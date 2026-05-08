ALTER TABLE "FactualAttendancePolicy"
ADD COLUMN IF NOT EXISTS "weekoffCompulsory" BOOLEAN DEFAULT false;

UPDATE "FactualAttendancePolicy"
SET "weekoffCompulsory" = COALESCE("countWorkhoursInMinutes", false)
WHERE "weekoffCompulsory" IS NULL OR "weekoffCompulsory" = false;
