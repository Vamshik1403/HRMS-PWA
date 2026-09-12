-- Additive only: persist ENPL expected duration and GPS site-visit snapshot on tasks.
ALTER TABLE "TaskProject" ADD COLUMN IF NOT EXISTS "expectedDurationMinutes" INTEGER;
ALTER TABLE "TaskProject" ADD COLUMN IF NOT EXISTS "siteVisits" JSONB;
ALTER TABLE "TaskProject" ADD COLUMN IF NOT EXISTS "siteVisitSummary" JSONB;
