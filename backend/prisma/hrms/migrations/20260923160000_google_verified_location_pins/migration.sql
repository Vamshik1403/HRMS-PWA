-- Additive location verification columns and Google API usage log. No data rewrite.

ALTER TABLE "Branches" ADD COLUMN IF NOT EXISTS "placeId" VARCHAR(256);
ALTER TABLE "Branches" ADD COLUMN IF NOT EXISTS "locationSource" VARCHAR(32);
ALTER TABLE "Branches" ADD COLUMN IF NOT EXISTS "locationVerified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "placeId" VARCHAR(256);
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "locationSource" VARCHAR(32);
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "locationVerified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TaskCustomerSite" ADD COLUMN IF NOT EXISTS "placeId" VARCHAR(256);
ALTER TABLE "TaskCustomerSite" ADD COLUMN IF NOT EXISTS "locationSource" VARCHAR(32);
ALTER TABLE "TaskCustomerSite" ADD COLUMN IF NOT EXISTS "locationVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "google_api_usage" (
  "id" SERIAL PRIMARY KEY,
  "api" VARCHAR(32) NOT NULL,
  "feature" VARCHAR(16) NOT NULL,
  "httpStatus" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "google_api_usage_createdAt_idx" ON "google_api_usage"("createdAt");
