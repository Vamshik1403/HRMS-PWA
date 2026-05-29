ALTER TABLE "TaskChat" ADD COLUMN IF NOT EXISTS "recipientEmployeeID" INTEGER;

CREATE INDEX IF NOT EXISTS "TaskChat_recipientEmployeeID_idx" ON "TaskChat"("recipientEmployeeID");

-- Backfill admin messages on single-assignee tasks so that employee can still see historical admin replies
UPDATE "TaskChat" c
SET "recipientEmployeeID" = sub."manageEmployeeID"
FROM (
  SELECT c2.id AS chat_id, ta."manageEmployeeID"
  FROM "TaskChat" c2
  INNER JOIN "TaskProject" t ON t.id = c2."taskID"
  INNER JOIN "TaskAssignment" ta ON ta."taskID" = t.id
  WHERE c2."userID" IS NOT NULL
    AND c2."recipientEmployeeID" IS NULL
    AND (SELECT COUNT(*) FROM "TaskAssignment" ta2 WHERE ta2."taskID" = t.id) = 1
) sub
WHERE c.id = sub.chat_id;

-- Admin replies after an employee message → address that employee
WITH ordered AS (
  SELECT id,
    LAG("employeeID") OVER (PARTITION BY "taskID" ORDER BY "createdAt") AS prev_emp
  FROM "TaskChat"
)
UPDATE "TaskChat" c
SET "recipientEmployeeID" = o.prev_emp
FROM ordered o
WHERE c.id = o.id
  AND c."userID" IS NOT NULL
  AND c."recipientEmployeeID" IS NULL
  AND o.prev_emp IS NOT NULL;
