CREATE TABLE IF NOT EXISTS "EmpAbsentDeclaration" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "absentDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "leaveType" VARCHAR(32) NOT NULL,
    "leaveApplicationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmpAbsentDeclaration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmpAbsentDeclaration_employeeId_absentDate_key"
    ON "EmpAbsentDeclaration"("employeeId", "absentDate");

CREATE INDEX IF NOT EXISTS "EmpAbsentDeclaration_employeeId_idx" ON "EmpAbsentDeclaration"("employeeId");

ALTER TABLE "EmpAbsentDeclaration" ADD CONSTRAINT "EmpAbsentDeclaration_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "ManageEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
