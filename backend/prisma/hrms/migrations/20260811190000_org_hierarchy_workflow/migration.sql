-- Department hierarchy + multi-branch mapping
ALTER TABLE "Departments" ADD COLUMN IF NOT EXISTS "parentDepartmentID" INTEGER;
CREATE INDEX IF NOT EXISTS "Departments_parentDepartmentID_idx" ON "Departments"("parentDepartmentID");
CREATE INDEX IF NOT EXISTS "Departments_companyID_idx" ON "Departments"("companyID");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Departments_parentDepartmentID_fkey'
  ) THEN
    ALTER TABLE "Departments"
      ADD CONSTRAINT "Departments_parentDepartmentID_fkey"
      FOREIGN KEY ("parentDepartmentID") REFERENCES "Departments"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DepartmentBranch" (
  "id" SERIAL PRIMARY KEY,
  "departmentID" INTEGER NOT NULL,
  "branchesID" INTEGER NOT NULL,
  CONSTRAINT "DepartmentBranch_departmentID_branchesID_key" UNIQUE ("departmentID", "branchesID")
);
CREATE INDEX IF NOT EXISTS "DepartmentBranch_departmentID_idx" ON "DepartmentBranch"("departmentID");
CREATE INDEX IF NOT EXISTS "DepartmentBranch_branchesID_idx" ON "DepartmentBranch"("branchesID");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBranch_departmentID_fkey') THEN
    ALTER TABLE "DepartmentBranch"
      ADD CONSTRAINT "DepartmentBranch_departmentID_fkey"
      FOREIGN KEY ("departmentID") REFERENCES "Departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBranch_branchesID_fkey') THEN
    ALTER TABLE "DepartmentBranch"
      ADD CONSTRAINT "DepartmentBranch_branchesID_fkey"
      FOREIGN KEY ("branchesID") REFERENCES "Branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill DepartmentBranch from existing single branchesID
INSERT INTO "DepartmentBranch" ("departmentID", "branchesID")
SELECT d."id", d."branchesID"
FROM "Departments" d
WHERE d."branchesID" IS NOT NULL
ON CONFLICT ("departmentID", "branchesID") DO NOTHING;

-- Designation → Department + parent designation
ALTER TABLE "Designations" ADD COLUMN IF NOT EXISTS "departmentID" INTEGER;
ALTER TABLE "Designations" ADD COLUMN IF NOT EXISTS "parentDesignationID" INTEGER;
CREATE INDEX IF NOT EXISTS "Designations_departmentID_idx" ON "Designations"("departmentID");
CREATE INDEX IF NOT EXISTS "Designations_parentDesignationID_idx" ON "Designations"("parentDesignationID");
CREATE INDEX IF NOT EXISTS "Designations_companyID_idx" ON "Designations"("companyID");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Designations_departmentID_fkey') THEN
    ALTER TABLE "Designations"
      ADD CONSTRAINT "Designations_departmentID_fkey"
      FOREIGN KEY ("departmentID") REFERENCES "Departments"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Designations_parentDesignationID_fkey') THEN
    ALTER TABLE "Designations"
      ADD CONSTRAINT "Designations_parentDesignationID_fkey"
      FOREIGN KEY ("parentDesignationID") REFERENCES "Designations"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- Workflow BRANCH condition support
ALTER TYPE "WorkflowConditionField" ADD VALUE IF NOT EXISTS 'BRANCH';
ALTER TYPE "WorkflowConditionValueType" ADD VALUE IF NOT EXISTS 'BRANCH';

ALTER TABLE "approval_workflow_conditions" ADD COLUMN IF NOT EXISTS "branchesID" INTEGER;
CREATE INDEX IF NOT EXISTS "approval_workflow_conditions_branchesID_idx" ON "approval_workflow_conditions"("branchesID");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_workflow_conditions_branchesID_fkey') THEN
    ALTER TABLE "approval_workflow_conditions"
      ADD CONSTRAINT "approval_workflow_conditions_branchesID_fkey"
      FOREIGN KEY ("branchesID") REFERENCES "Branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Workflow step: reporting manager support + optional designation
ALTER TABLE "approval_workflow_steps" ADD COLUMN IF NOT EXISTS "approverType" VARCHAR(32) NOT NULL DEFAULT 'DESIGNATION';
ALTER TABLE "approval_workflow_steps" ALTER COLUMN "designationID" DROP NOT NULL;
