-- Add allowRotatingShift field to ManageEmployee
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "allowRotatingShift" BOOLEAN NOT NULL DEFAULT false;
