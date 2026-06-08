CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "username" VARCHAR(255),
    "employeeName" VARCHAR(255),
    "userRole" VARCHAR(64),
    "action" VARCHAR(64) NOT NULL,
    "module" VARCHAR(64) NOT NULL,
    "entityId" VARCHAR(64),
    "entityName" VARCHAR(255),
    "oldData" TEXT,
    "newData" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" VARCHAR(512),
    "ipAddress" VARCHAR(64),
    "browser" VARCHAR(128),
    "os" VARCHAR(128),
    "deviceType" VARCHAR(64),
    "location" VARCHAR(255),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_module_createdAt_idx" ON "AuditLog"("module", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_username_createdAt_idx" ON "AuditLog"("username", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE TABLE IF NOT EXISTS "BackupRestoreLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "username" VARCHAR(255),
    "backupDate" VARCHAR(16) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileLabel" VARCHAR(255),
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "ipAddress" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupRestoreLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BackupRestoreLog_createdAt_idx" ON "BackupRestoreLog"("createdAt");
CREATE INDEX IF NOT EXISTS "BackupRestoreLog_username_idx" ON "BackupRestoreLog"("username");
