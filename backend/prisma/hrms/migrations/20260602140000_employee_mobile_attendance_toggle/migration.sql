-- When enabled, the employee punches in/out ONLY via the PWA mobile app and
-- their biometric/device punches are ignored. When disabled (default), the
-- employee punches in/out ONLY via the assigned device and the PWA punch is
-- blocked. Existing employees default to device-only to preserve behaviour.
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "mobileAttendanceEnabled" BOOLEAN NOT NULL DEFAULT false;
