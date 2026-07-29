#!/usr/bin/env python3
"""OR hasModuleWriteAccess into admin canManage/canCreate/canAdd checks."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path("/home/server/HRMS-PWA/HRMS-PWA/frontend/app")

# path relative to app/ -> module key
FILE_MODULE = {
    "branches/BranchManagement.tsx": "BRANCHES",
    "departments/DepartmentManagement.tsx": "DEPARTMENTS",
    "designations/DesignationManagement.tsx": "DESIGNATIONS",
    "devices/DeviceManagement.tsx": "DEVICES",
    "contractors/ContractorManagement.tsx": "CONTRACTORS",
    "contractor-rates/ContractorRatesManagement.tsx": "CONTRACTOR_RATES",
    "contractor-payout/ContractorPayoutsManagement.tsx": "CONTRACTORS",
    "work-shifts/WorkShiftsManagement.tsx": "WORK_SHIFTS",
    "work-shifts/FactualWorkShiftsManagement.tsx": "WORK_SHIFTS",
    "attendance-policy/AttendancePolicyManagement.tsx": "ATTENDANCE_POLICY",
    "attendance-policy/FactualAttendancePolicyManagement.tsx": "ATTENDANCE_POLICY",
    "manage-holidays/ManageHolidaysManagement.tsx": "HOLIDAYS",
    "public-holiday/PublicHolidayManagement.tsx": "HOLIDAYS",
    "leave-policy/LeavePolicyManagement.tsx": "LEAVE_POLICY",
    "leave-applications/LeaveApplicationsManagement.tsx": "LEAVE_APPLICATIONS",
    "privileged-leave/PrivilegedLeaveManagement.tsx": "LEAVE_APPLICATIONS",
    "attendance-regularisation/AttendanceRegularisationManagement.tsx": "REGULARISATION",
    "termination/TerminationPageView.tsx": "OFFBOARDING",
    "monthly-salary-cycle/MonthlySalaryCycleManagement.tsx": "PAYROLL",
    "salary-allowances/SalaryAllowancesManagement.tsx": "PAYROLL",
    "salary-deductions/SalaryDeductionsManagement.tsx": "PAYROLL",
    "monthly-pay-grade/MonthlyPayGradeManagement.tsx": "PAYROLL",
    "bonus-setup/BonusSetupManagement.tsx": "PAYROLL",
    "bonus-allocations/BonusAllocationsManagement.tsx": "PAYROLL",
    "generate-salary/GenerateSalaryManagement.tsx": "PAYROLL",
    "salary-advance/SalaryAdvance.tsx": "SALARY_ADVANCES",
    "reimbursement/ReimbursementPage.tsx": "REIMBURSEMENTS",
    "task-customers/CustomerManagement.tsx": "TASKS",
    "task-customer-sites/SiteManagement.tsx": "TASKS",
    "task-projects/TaskManagement.tsx": "TASKS",
    "employee-weekly-off/EmployeeWeeklyOffManagement.tsx": "HOLIDAYS",
    "employee-holiday-override/EmployeeHolidayOverrideManagement.tsx": "HOLIDAYS",
    "employees-promotions/EmployeesPromotionsManagement.tsx": "EMPLOYEES",
}

IMPORT_LINE = 'import { hasModuleWriteAccess } from "@/lib/companyAccess";'


def ensure_import(text: str) -> str:
    if "hasModuleWriteAccess" in text:
        return text
    # Prefer after existing @/lib imports
    m = re.search(r'^import .+ from "@/lib/[^"]+";\s*$', text, re.M)
    if m:
        idx = m.end()
        return text[:idx] + "\n" + IMPORT_LINE + text[idx:]
    # After first import block line with useCurrentUser / auth
    m = re.search(r'^import .+;\s*$', text, re.M)
    if m:
        idx = m.end()
        return text[:idx] + "\n" + IMPORT_LINE + text[idx:]
    return IMPORT_LINE + "\n" + text


def patch_assignment(text: str, var: str, module: str) -> str:
    """Append || hasModuleWriteAccess("MODULE") to const canManage / canCreate / canAdd."""
    needle = f"hasModuleWriteAccess(\"{module}\")"

    # Multi-line: const canManage =\n  a ||\n  b;
    pattern_ml = re.compile(
        rf'(const {var}\s*=\s*\n(?:.*\|\|\s*\n)*.*?)(;)',
        re.M,
    )

    def repl_ml(m: re.Match) -> str:
        body = m.group(1)
        if needle in body:
            return m.group(0)
        # trim trailing whitespace on last line before ;
        return body.rstrip() + f" ||\n    {needle}" + m.group(2)

    new_text, n = pattern_ml.subn(repl_ml, text, count=1)
    if n:
        return new_text

    # Single line
    pattern_sl = re.compile(rf'(const {var}\s*=\s*)(.+?)(;)')

    def repl_sl(m: re.Match) -> str:
        expr = m.group(2).rstrip()
        if needle in expr:
            return m.group(0)
        return f"{m.group(1)}{expr} || {needle}{m.group(3)}"

    new_text, n = pattern_sl.subn(repl_sl, text, count=1)
    return new_text if n else text


def main() -> None:
    for rel, module in FILE_MODULE.items():
        path = ROOT / rel
        if not path.exists():
            print(f"MISSING {rel}")
            continue
        text = path.read_text()
        original = text
        text = ensure_import(text)
        for var in ("canManage", "canCreate", "canAdd"):
            if re.search(rf"const {var}\s*=", text):
                text = patch_assignment(text, var, module)
        if text != original:
            path.write_text(text)
            print(f"PATCHED {rel} -> {module}")
        else:
            print(f"SKIP {rel}")


if __name__ == "__main__":
    main()
