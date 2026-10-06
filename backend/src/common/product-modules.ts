/** Product subscription modules. Bundles are UI groupings only. */

export const SUBSCRIPTION_EXEMPT_COMPANY_IDS = [2, 3] as const;

export const ATTENDANCE_MODULE = 'ATTENDANCE_MODULE';
export const ATTENDANCE_HISTORY_MODULE = 'ATTENDANCE_HISTORY_MODULE';
export const WORKSHIFT_ROSTER_MODULE = 'WORKSHIFT_ROSTER_MODULE';
export const ATTENDANCE_POLICY_MODULE = 'ATTENDANCE_POLICY_MODULE';
export const REGULARISATION_MODULE = 'REGULARISATION_MODULE';
export const HOLIDAY_MODULE = 'HOLIDAY_MODULE';
export const DELEGATION_MODULE = 'DELEGATION_MODULE';
export const MY_CALENDAR_MODULE = 'MY_CALENDAR_MODULE';
export const TEAM_APPROVALS_MODULE = 'TEAM_APPROVALS_MODULE';
export const PROMOTIONS_MODULE = 'PROMOTIONS_MODULE';
export const TRANSFERS_MODULE = 'TRANSFERS_MODULE';
export const GEO_MARKING_MODULE = 'GEO_MARKING_MODULE';
export const GEO_FENCING_MODULE = 'GEO_FENCING_MODULE';
export const REIMBURSEMENT_MODULE = 'REIMBURSEMENT_MODULE';
export const PAYSLIP_MODULE = 'PAYSLIP_MODULE';
export const LOAN_ADVANCE_MODULE = 'LOAN_ADVANCE_MODULE';
export const IM_MODULE = 'IM_MODULE';
export const TASK_MODULE = 'TASK_MODULE';
export const ONFIELD_TASK_MODULE = 'ONFIELD_TASK_MODULE';
export const PAYROLL_MODULE = 'PAYROLL_MODULE';
export const OFF_BOARDING_MODULE = 'OFF_BOARDING_MODULE';
export const CONTRACTOR_MODULE = 'CONTRACTOR_MODULE';
export const ADVANCE_REPORTING_MODULE = 'ADVANCE_REPORTING_MODULE';
export const LEAVE_MODULE = 'LEAVE_MODULE';
export const EMPLOYEE_MANAGEMENT_MODULE = 'EMPLOYEE_MANAGEMENT_MODULE';

export const ATTENDANCE_CORE_MODULE_KEYS = [
  ATTENDANCE_MODULE,
  ATTENDANCE_HISTORY_MODULE,
  WORKSHIFT_ROSTER_MODULE,
  ATTENDANCE_POLICY_MODULE,
  REGULARISATION_MODULE,
  HOLIDAY_MODULE,
  DELEGATION_MODULE,
  MY_CALENDAR_MODULE,
  TEAM_APPROVALS_MODULE,
  PROMOTIONS_MODULE,
  TRANSFERS_MODULE,
  EMPLOYEE_MANAGEMENT_MODULE,
  OFF_BOARDING_MODULE,
] as const;

export const ADDON_MODULE_KEYS = [
  GEO_MARKING_MODULE,
  GEO_FENCING_MODULE,
  REIMBURSEMENT_MODULE,
  PAYSLIP_MODULE,
  LOAN_ADVANCE_MODULE,
  IM_MODULE,
  TASK_MODULE,
  ONFIELD_TASK_MODULE,
] as const;

export const PRODUCT_MODULE_CATALOG: { moduleKey: string; moduleName: string; sortOrder: number }[] = [
  { moduleKey: ATTENDANCE_MODULE, moduleName: 'Attendance', sortOrder: 1 },
  { moduleKey: ATTENDANCE_HISTORY_MODULE, moduleName: 'Attendance History', sortOrder: 2 },
  { moduleKey: WORKSHIFT_ROSTER_MODULE, moduleName: 'WorkShift & Roster', sortOrder: 3 },
  { moduleKey: ATTENDANCE_POLICY_MODULE, moduleName: 'Attendance Policy', sortOrder: 14 },
  { moduleKey: REGULARISATION_MODULE, moduleName: 'Regularization', sortOrder: 15 },
  { moduleKey: HOLIDAY_MODULE, moduleName: 'Holidays', sortOrder: 16 },
  { moduleKey: DELEGATION_MODULE, moduleName: 'Delegation', sortOrder: 17 },
  { moduleKey: MY_CALENDAR_MODULE, moduleName: 'My Calendar', sortOrder: 18 },
  { moduleKey: TEAM_APPROVALS_MODULE, moduleName: 'Team Approvals', sortOrder: 19 },
  { moduleKey: PROMOTIONS_MODULE, moduleName: 'Promotions', sortOrder: 20 },
  { moduleKey: TRANSFERS_MODULE, moduleName: 'Transfers', sortOrder: 21 },
  { moduleKey: GEO_MARKING_MODULE, moduleName: 'Geo Marking', sortOrder: 4 },
  { moduleKey: GEO_FENCING_MODULE, moduleName: 'Geo Fencing', sortOrder: 5 },
  { moduleKey: PAYROLL_MODULE, moduleName: 'Payroll', sortOrder: 6 },
  { moduleKey: OFF_BOARDING_MODULE, moduleName: 'Off Boarding', sortOrder: 7 },
  { moduleKey: REIMBURSEMENT_MODULE, moduleName: 'Reimbursement', sortOrder: 8 },
  { moduleKey: IM_MODULE, moduleName: 'Instant Messaging', sortOrder: 9 },
  { moduleKey: TASK_MODULE, moduleName: 'Task Management', sortOrder: 10 },
  { moduleKey: ONFIELD_TASK_MODULE, moduleName: 'On-Field Task Management', sortOrder: 11 },
  { moduleKey: CONTRACTOR_MODULE, moduleName: 'Contractor Management', sortOrder: 12 },
  { moduleKey: ADVANCE_REPORTING_MODULE, moduleName: 'Advance Reporting', sortOrder: 13 },
  { moduleKey: PAYSLIP_MODULE, moduleName: 'Payslip', sortOrder: 22 },
  { moduleKey: LOAN_ADVANCE_MODULE, moduleName: 'Loan Advances', sortOrder: 23 },
  { moduleKey: LEAVE_MODULE, moduleName: 'Leave', sortOrder: 24 },
  { moduleKey: EMPLOYEE_MANAGEMENT_MODULE, moduleName: 'Employee Management', sortOrder: 25 },
];

export const ALL_PRODUCT_MODULE_KEYS = PRODUCT_MODULE_CATALOG.map((item) => item.moduleKey);

const PRIVILEGED_ROLES = new Set(['SUPERADMIN', 'SERVICE_PROVIDER']);

export function isPrivilegedSubscriptionRole(role?: string | null): boolean {
  return PRIVILEGED_ROLES.has(String(role || '').toUpperCase());
}

export function isSubscriptionExemptCompany(companyId?: number | null): boolean {
  return SUBSCRIPTION_EXEMPT_COMPANY_IDS.includes(Number(companyId) as 2 | 3);
}

/** Employee-rights keys that can reduce access. Empty means subscription alone decides. */
export function rightsKeysForProductModule(moduleKey: string): string[] {
  switch (moduleKey) {
    case WORKSHIFT_ROSTER_MODULE:
      return ['WORK_SHIFTS', 'ROSTER'];
    case ATTENDANCE_POLICY_MODULE:
      return ['ATTENDANCE_POLICY'];
    case REGULARISATION_MODULE:
      return ['REGULARISATION'];
    case HOLIDAY_MODULE:
      return ['HOLIDAYS'];
    case LEAVE_MODULE:
      return ['LEAVE_APPLICATIONS', 'LEAVE_POLICY'];
    case PAYROLL_MODULE:
      return ['PAYROLL'];
    case REIMBURSEMENT_MODULE:
      return ['REIMBURSEMENTS'];
    case LOAN_ADVANCE_MODULE:
      return ['SALARY_ADVANCES'];
    case IM_MODULE:
      return ['MESSAGING'];
    case TASK_MODULE:
    case ONFIELD_TASK_MODULE:
      return ['TASKS'];
    case OFF_BOARDING_MODULE:
      return ['OFFBOARDING'];
    case CONTRACTOR_MODULE:
      return ['CONTRACTORS', 'CONTRACTOR_RATES'];
    case ADVANCE_REPORTING_MODULE:
      return ['REPORTS'];
    case EMPLOYEE_MANAGEMENT_MODULE:
      return ['EMPLOYEES', 'DEPARTMENTS', 'DESIGNATIONS', 'BRANCHES', 'DEVICES'];
    default:
      return [];
  }
}

/** Rights keys unlocked by the given product modules. A key with no product module is omitted. */
export function rightsKeysCoveredByProductModules(moduleKeys: string[]): Set<string> {
  const keys = new Set<string>();
  for (const moduleKey of moduleKeys) {
    for (const rightsKey of rightsKeysForProductModule(moduleKey)) keys.add(rightsKey);
  }
  return keys;
}

function cleanPath(url: string): string {
  const noQuery = String(url || '').split('?')[0];
  const stripped = noQuery.replace(/^\/backend(?=\/)/, '');
  if (stripped.length > 1 && stripped.endsWith('/')) return stripped.slice(0, -1);
  return stripped || '/';
}

function starts(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Any listed module satisfies the request. Null means the route is not subscription-gated. */
export function productModulesForRequest(url: string, method?: string): string[] | null {
  const path = cleanPath(url);
  const verb = String(method || 'GET').toUpperCase();

  if (path.includes('/delegations') || path.endsWith('/delegation-colleagues')) {
    return [DELEGATION_MODULE];
  }
  if (
    path.includes('/site-visit') ||
    path.includes('field-attendance') ||
    starts(path, '/emp-field-site-attendance')
  ) {
    return [ONFIELD_TASK_MODULE];
  }
  if (starts(path, '/emp-location-attendance')) return [ATTENDANCE_MODULE];
  if (starts(path, '/emp-attendance-logs')) return [ATTENDANCE_HISTORY_MODULE];
  if (
    starts(path, '/work-shift') ||
    starts(path, '/rosters') ||
    starts(path, '/roster-days') ||
    starts(path, '/roster-employees') ||
    starts(path, '/employee-weekly-off')
  ) {
    return [WORKSHIFT_ROSTER_MODULE];
  }
  if (starts(path, '/attendance-policy')) return [ATTENDANCE_POLICY_MODULE];
  if (starts(path, '/emp-attendance-regularise')) return [REGULARISATION_MODULE];
  if (
    starts(path, '/manage-holiday') ||
    starts(path, '/public-holiday') ||
    starts(path, '/employee-holiday-override')
  ) {
    return [HOLIDAY_MODULE];
  }
  if (starts(path, '/calendar')) return [MY_CALENDAR_MODULE];
  if (
    starts(path, '/leave-policy') ||
    starts(path, '/leave-application') ||
    starts(path, '/leave-application-request') ||
    starts(path, '/privileged-leave') ||
    starts(path, '/emp-leave-balance')
  ) {
    return [LEAVE_MODULE];
  }
  if (starts(path, '/reimbursement')) return [REIMBURSEMENT_MODULE];
  if (starts(path, '/salary-advance')) return [LOAN_ADVANCE_MODULE];
  if (
    starts(path, '/salary-cycle') ||
    starts(path, '/salary-allowance') ||
    starts(path, '/salary-deduction') ||
    starts(path, '/monthly-pay-grade') ||
    starts(path, '/hourly-pay-grade') ||
    starts(path, '/bonus-setup') ||
    starts(path, '/bonus-allocation')
  ) {
    return [PAYROLL_MODULE];
  }
  if (starts(path, '/generate-salary')) {
    return verb === 'GET' ? [PAYSLIP_MODULE, PAYROLL_MODULE] : [PAYROLL_MODULE];
  }
  if (starts(path, '/employee-memo')) return [IM_MODULE];
  if (starts(path, '/task-customers') || starts(path, '/task-customer-sites')) return [TASK_MODULE];
  if (starts(path, '/task-projects')) return [TASK_MODULE];
  if (starts(path, '/emp-promotion') || starts(path, '/promotion-request')) {
    return [PROMOTIONS_MODULE, TRANSFERS_MODULE];
  }
  if (starts(path, '/contractors') || starts(path, '/contractor-payout') || starts(path, '/contractor-rates')) {
    return [CONTRACTOR_MODULE];
  }
  if (starts(path, '/termination')) return [OFF_BOARDING_MODULE];
  return null;
}

export function istCalendarParts(input: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(input);
  return {
    y: Number(parts.find((p) => p.type === 'year')?.value),
    m: Number(parts.find((p) => p.type === 'month')?.value),
    d: Number(parts.find((p) => p.type === 'day')?.value),
  };
}

/** Inclusive start of the IST calendar day. */
export function startOfIstDay(input: Date): Date {
  const { y, m, d } = istCalendarParts(input);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000);
}

/** Inclusive end of the IST calendar day, validityDays after the start day (day 1 is the start date). */
export function endOfIstValidity(start: Date, validityDays: number): Date {
  const { y, m, d } = istCalendarParts(start);
  const end = new Date(Date.UTC(y, m - 1, d));
  end.setUTCDate(end.getUTCDate() + Math.max(1, validityDays) - 1);
  return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 18, 29, 59, 999));
}
