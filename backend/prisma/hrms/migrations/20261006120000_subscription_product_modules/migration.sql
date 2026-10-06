INSERT INTO "Module" ("moduleKey", "moduleName", "description", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('ATTENDANCE_POLICY_MODULE', 'Attendance Policy', NULL, false, 14, NOW(), NOW()),
  ('REGULARISATION_MODULE', 'Regularization', NULL, false, 15, NOW(), NOW()),
  ('HOLIDAY_MODULE', 'Holidays', NULL, false, 16, NOW(), NOW()),
  ('DELEGATION_MODULE', 'Delegation', NULL, false, 17, NOW(), NOW()),
  ('MY_CALENDAR_MODULE', 'My Calendar', NULL, false, 18, NOW(), NOW()),
  ('TEAM_APPROVALS_MODULE', 'Team Approvals', NULL, false, 19, NOW(), NOW()),
  ('PROMOTIONS_MODULE', 'Promotions', NULL, false, 20, NOW(), NOW()),
  ('TRANSFERS_MODULE', 'Transfers', NULL, false, 21, NOW(), NOW()),
  ('PAYSLIP_MODULE', 'Payslip', NULL, false, 22, NOW(), NOW()),
  ('LOAN_ADVANCE_MODULE', 'Loan Advances', NULL, false, 23, NOW(), NOW()),
  ('LEAVE_MODULE', 'Leave', NULL, false, 24, NOW(), NOW())
ON CONFLICT ("moduleKey") DO NOTHING;
