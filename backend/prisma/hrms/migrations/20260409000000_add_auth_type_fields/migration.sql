-- Add authTypes array to Devices (for multi-purpose single device config)
ALTER TABLE "Devices" ADD COLUMN IF NOT EXISTS "authTypes" TEXT[] DEFAULT '{}';

-- Add authType to AttendanceLogs (ESSL verify mode: FACE/FINGER/PIN/CARD)
ALTER TABLE "AttendanceLogs" ADD COLUMN IF NOT EXISTS "authType" VARCHAR;

-- Add auth_type to process_att_logs
ALTER TABLE "process_att_logs" ADD COLUMN IF NOT EXISTS "auth_type" VARCHAR(20);

-- Add auth_type to canteen tables
ALTER TABLE "canteen_tr_logs" ADD COLUMN IF NOT EXISTS "auth_type" VARCHAR(20);
ALTER TABLE "canteen_tv_logs" ADD COLUMN IF NOT EXISTS "auth_type" VARCHAR(20);
ALTER TABLE "canteen_tv_not_logs" ADD COLUMN IF NOT EXISTS "auth_type" VARCHAR(20);

-- Add auth_type to essl_raw_attlog (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'essl_raw_attlog') THEN
        ALTER TABLE "essl_raw_attlog" ADD COLUMN IF NOT EXISTS "auth_type" VARCHAR(20);
    END IF;
END $$;
