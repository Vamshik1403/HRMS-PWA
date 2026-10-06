INSERT INTO "Module" ("moduleKey", "moduleName", "description", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('EMPLOYEE_MANAGEMENT_MODULE', 'Employee Management', NULL, false, 25, NOW(), NOW())
ON CONFLICT ("moduleKey") DO NOTHING;

INSERT INTO "SubscriptionPlanModule" ("planID", "moduleID", "createdAt")
SELECT DISTINCT spm."planID", target.id, NOW()
FROM "SubscriptionPlanModule" spm
JOIN "Module" attendance ON attendance.id = spm."moduleID" AND attendance."moduleKey" = 'ATTENDANCE_MODULE'
JOIN "Module" target ON target."moduleKey" IN ('EMPLOYEE_MANAGEMENT_MODULE', 'OFF_BOARDING_MODULE')
ON CONFLICT ("planID", "moduleID") DO NOTHING;

INSERT INTO "CompanyModule" ("companyID", "moduleID", "isEnabled", "createdAt", "updatedAt")
SELECT DISTINCT cs."companyID", target.id, true, NOW(), NOW()
FROM "CompanySubscription" cs
JOIN "SubscriptionPlanModule" spm ON spm."planID" = cs."planID"
JOIN "Module" attendance ON attendance.id = spm."moduleID" AND attendance."moduleKey" = 'ATTENDANCE_MODULE'
JOIN "Module" target ON target."moduleKey" IN ('EMPLOYEE_MANAGEMENT_MODULE', 'OFF_BOARDING_MODULE')
WHERE cs."companyID" NOT IN (2, 3)
ON CONFLICT ("companyID", "moduleID") DO UPDATE SET "isEnabled" = true, "updatedAt" = NOW();
