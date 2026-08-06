-- Structured emergency contacts (name, relation, contact number) per employee.
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "emergencyContacts" JSONB;
