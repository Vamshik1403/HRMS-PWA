/** Mirrors backend product module keys. Bundles are plan-form groupings only. */

export const ATTENDANCE_CORE_MODULE_KEYS = [
  "ATTENDANCE_MODULE",
  "ATTENDANCE_HISTORY_MODULE",
  "WORKSHIFT_ROSTER_MODULE",
  "ATTENDANCE_POLICY_MODULE",
  "REGULARISATION_MODULE",
  "HOLIDAY_MODULE",
  "DELEGATION_MODULE",
  "MY_CALENDAR_MODULE",
  "TEAM_APPROVALS_MODULE",
  "PROMOTIONS_MODULE",
  "TRANSFERS_MODULE",
  "EMPLOYEE_MANAGEMENT_MODULE",
  "OFF_BOARDING_MODULE",
] as const;

export const ADDON_MODULE_KEYS = [
  "GEO_MARKING_MODULE",
  "GEO_FENCING_MODULE",
  "REIMBURSEMENT_MODULE",
  "PAYSLIP_MODULE",
  "LOAN_ADVANCE_MODULE",
  "IM_MODULE",
  "TASK_MODULE",
  "ONFIELD_TASK_MODULE",
] as const;

export type ProductRouteRule = {
  prefix: string;
  anyOf: string[];
  /** Match only when the query string contains this tab. */
  tab?: string;
};

export const PRODUCT_ROUTE_RULES: ProductRouteRule[] = [
  { prefix: "/empAttendance", anyOf: ["ATTENDANCE_MODULE"] },
  { prefix: "/empHistory", anyOf: ["ATTENDANCE_HISTORY_MODULE"] },
  { prefix: "/attendance-logs", anyOf: ["ATTENDANCE_HISTORY_MODULE"] },
  { prefix: "/work-shifts", anyOf: ["WORKSHIFT_ROSTER_MODULE"] },
  { prefix: "/roster", anyOf: ["WORKSHIFT_ROSTER_MODULE"] },
  { prefix: "/attendance-policy", anyOf: ["ATTENDANCE_POLICY_MODULE"] },
  { prefix: "/attendance-regularisation", anyOf: ["REGULARISATION_MODULE"] },
  { prefix: "/empTeam/regularisation", anyOf: ["REGULARISATION_MODULE"] },
  { prefix: "/manage-holidays", anyOf: ["HOLIDAY_MODULE"] },
  { prefix: "/public-holiday", anyOf: ["HOLIDAY_MODULE"] },
  { prefix: "/empHolidays", anyOf: ["HOLIDAY_MODULE"] },
  { prefix: "/empPublicHoliday", anyOf: ["HOLIDAY_MODULE"] },
  { prefix: "/employee-holiday-override", anyOf: ["HOLIDAY_MODULE"] },
  { prefix: "/empdashboard", anyOf: ["MY_CALENDAR_MODULE"], tab: "calendar" },
  { prefix: "/empTeam/approvals", anyOf: ["TEAM_APPROVALS_MODULE"] },
  { prefix: "/empTeam/promotions", anyOf: ["PROMOTIONS_MODULE", "TRANSFERS_MODULE"] },
  { prefix: "/employees-promotions", anyOf: ["PROMOTIONS_MODULE", "TRANSFERS_MODULE"] },
  { prefix: "/empProfile", anyOf: ["DELEGATION_MODULE"], tab: "delegation" },
  { prefix: "/empProfile", anyOf: ["LEAVE_MODULE"], tab: "leave" },
  { prefix: "/empProfile", anyOf: ["REIMBURSEMENT_MODULE"], tab: "reimbursement" },
  { prefix: "/empProfile", anyOf: ["PAYSLIP_MODULE"], tab: "payslips" },
  { prefix: "/empProfile", anyOf: ["LOAN_ADVANCE_MODULE"], tab: "salary-advance" },
  { prefix: "/empProfile", anyOf: ["REGULARISATION_MODULE"], tab: "regularisation" },
  { prefix: "/empProfile", anyOf: ["HOLIDAY_MODULE"], tab: "holidays" },
  { prefix: "/empProfile", anyOf: ["IM_MODULE"], tab: "messaging" },
  { prefix: "/empTeam/member", anyOf: ["LEAVE_MODULE"], tab: "leave" },
  { prefix: "/empTeam/member", anyOf: ["REIMBURSEMENT_MODULE"], tab: "reimbursement" },
  { prefix: "/empTeam/member", anyOf: ["PAYSLIP_MODULE"], tab: "payslips" },
  { prefix: "/empTeam/member", anyOf: ["LOAN_ADVANCE_MODULE"], tab: "salary-advance" },
  { prefix: "/empTeam/member", anyOf: ["REGULARISATION_MODULE"], tab: "regularisation" },
  { prefix: "/empTeam/member", anyOf: ["HOLIDAY_MODULE"], tab: "holidays" },
  { prefix: "/empTeam/member", anyOf: ["IM_MODULE"], tab: "messaging" },
  { prefix: "/empTeam/member", anyOf: ["PROMOTIONS_MODULE", "TRANSFERS_MODULE"], tab: "promotions" },
  { prefix: "/my-company/company", anyOf: ["EMPLOYEE_MANAGEMENT_MODULE"], tab: "dashboard" },
  { prefix: "/my-company/company", anyOf: ["EMPLOYEE_MANAGEMENT_MODULE"], tab: "hierarchy" },
  { prefix: "/my-company/company", anyOf: ["EMPLOYEE_MANAGEMENT_MODULE"], tab: "branches" },
  { prefix: "/my-company/company", anyOf: ["EMPLOYEE_MANAGEMENT_MODULE"], tab: "devices" },
  { prefix: "/my-company/company", anyOf: ["EMPLOYEE_MANAGEMENT_MODULE"], tab: "federal-domain" },
  { prefix: "/my-company/company", anyOf: ["EMPLOYEE_MANAGEMENT_MODULE"], tab: "directory" },
  { prefix: "/federal-domain", anyOf: ["EMPLOYEE_MANAGEMENT_MODULE"] },
  { prefix: "/empNoticeboard", anyOf: ["IM_MODULE"] },
  { prefix: "/employee-memo", anyOf: ["IM_MODULE"] },
  { prefix: "/leave-policy", anyOf: ["LEAVE_MODULE"] },
  { prefix: "/leave-applications", anyOf: ["LEAVE_MODULE"] },
  { prefix: "/privileged-leave", anyOf: ["LEAVE_MODULE"] },
  { prefix: "/empLeaveApplication", anyOf: ["LEAVE_MODULE"] },
  { prefix: "/reimbursement", anyOf: ["REIMBURSEMENT_MODULE"] },
  { prefix: "/empReimbursement", anyOf: ["REIMBURSEMENT_MODULE"] },
  { prefix: "/salary-advance", anyOf: ["LOAN_ADVANCE_MODULE"] },
  { prefix: "/empSalaryAdvance", anyOf: ["LOAN_ADVANCE_MODULE"] },
  { prefix: "/empPayout", anyOf: ["PAYSLIP_MODULE"] },
  { prefix: "/generate-salary", anyOf: ["PAYROLL_MODULE"] },
  { prefix: "/empGenerateSalary", anyOf: ["PAYROLL_MODULE"] },
  { prefix: "/monthly-salary-cycle", anyOf: ["PAYROLL_MODULE"] },
  { prefix: "/salary-allowances", anyOf: ["PAYROLL_MODULE"] },
  { prefix: "/salary-deductions", anyOf: ["PAYROLL_MODULE"] },
  { prefix: "/monthly-pay-grade", anyOf: ["PAYROLL_MODULE"] },
  { prefix: "/bonus-setup", anyOf: ["PAYROLL_MODULE"] },
  { prefix: "/bonus-allocations", anyOf: ["PAYROLL_MODULE"] },
  { prefix: "/empMyTasks", anyOf: ["TASK_MODULE", "ONFIELD_TASK_MODULE"] },
  { prefix: "/task-projects", anyOf: ["TASK_MODULE", "ONFIELD_TASK_MODULE"] },
  { prefix: "/task-customers", anyOf: ["TASK_MODULE"] },
  { prefix: "/task-customer-sites", anyOf: ["TASK_MODULE"] },
  { prefix: "/contractors", anyOf: ["CONTRACTOR_MODULE"] },
  { prefix: "/contractor-rates", anyOf: ["CONTRACTOR_MODULE"] },
  { prefix: "/contractor-payout", anyOf: ["CONTRACTOR_MODULE"] },
  { prefix: "/termination", anyOf: ["OFF_BOARDING_MODULE"] },
  { prefix: "/attendance-reports", anyOf: ["ADVANCE_REPORTING_MODULE"] },
  { prefix: "/payroll-reports", anyOf: ["ADVANCE_REPORTING_MODULE"] },
  { prefix: "/leave-reports", anyOf: ["ADVANCE_REPORTING_MODULE"] },
  { prefix: "/statutory-reports", anyOf: ["ADVANCE_REPORTING_MODULE"] },
  { prefix: "/contractor-reports", anyOf: ["ADVANCE_REPORTING_MODULE"] },
];

export function productRuleForHref(href: string): ProductRouteRule | null {
  const [pathPart, queryPart] = href.split("?");
  const path = pathPart || "/";
  const params = new URLSearchParams(queryPart || "");
  const tab = params.get("tab");
  const matches = PRODUCT_ROUTE_RULES.filter((rule) => {
    const pathHit = path === rule.prefix || path.startsWith(`${rule.prefix}/`);
    if (!pathHit) return false;
    if (rule.tab) return tab === rule.tab;
    return !tab || !PRODUCT_ROUTE_RULES.some((other) => other.prefix === rule.prefix && other.tab === tab);
  });
  if (tab) {
    const exact = matches.find((rule) => rule.tab === tab);
    if (exact) return exact;
  }
  return matches.find((rule) => !rule.tab) ?? null;
}
