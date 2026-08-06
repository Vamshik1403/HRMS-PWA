-- Who pays the employee's salary: "Company" or "Contractor". Contractor-paid
-- employees also appear in the Contract Employee section.
ALTER TABLE "ManageEmployee" ADD COLUMN IF NOT EXISTS "salaryPayoutTo" VARCHAR;
