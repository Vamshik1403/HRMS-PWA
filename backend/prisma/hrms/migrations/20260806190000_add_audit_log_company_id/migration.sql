-- Scope audit logs to a company so tenant owners can view their own system logs.
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "companyID" INTEGER;
CREATE INDEX IF NOT EXISTS "AuditLog_companyID_createdAt_idx" ON "AuditLog" ("companyID", "createdAt");
