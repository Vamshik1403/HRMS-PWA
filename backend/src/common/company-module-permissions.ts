export const COMPANY_MODULE_KEYS = [
  'EMPLOYEES',
  'OFFBOARDING',
  'BRANCHES',
  'DEPARTMENTS',
  'DESIGNATIONS',
  'DEVICES',
  'CONTRACTORS',
  'CONTRACTOR_RATES',
  'WORK_SHIFTS',
  'ATTENDANCE_POLICY',
  'ROSTER',
  'REGULARISATION',
  'HOLIDAYS',
  'LEAVE_POLICY',
  'LEAVE_APPLICATIONS',
  'PAYROLL',
  'REIMBURSEMENTS',
  'SALARY_ADVANCES',
  'TASKS',
  'MESSAGING',
  'REPORTS',
  'IMPORT_ATTENDANCE',
  'SETTINGS',
  'RIGHTS',
] as const;

export type CompanyModuleKey = (typeof COMPANY_MODULE_KEYS)[number];

export const LEGAL_ENTITY_TYPES = [
  'SOLE_PROPRIETORSHIP',
  'PARTNERSHIP',
  'LLP',
  'OPC',
  'PRIVATE_LIMITED',
  'PUBLIC_LIMITED',
  'SECTION_8',
  'TRUST',
  'SOCIETY',
  'GOVERNMENT_PSU',
  'COOPERATIVE_SOCIETY',
] as const;

export const USER_TYPE_OPTIONS_BY_ENTITY: Record<string, string[]> = {
  SOLE_PROPRIETORSHIP: ['Proprietor', 'Owner', 'Founder', 'Company Administrator', 'HR Head'],
  PARTNERSHIP: ['Partner', 'Managing Partner', 'Company Administrator', 'HR Head'],
  LLP: ['Designated Partner', 'Partner', 'Managing Partner', 'Company Administrator', 'HR Head'],
  OPC: ['Director', 'Owner', 'Founder', 'Company Administrator', 'HR Head'],
  PRIVATE_LIMITED: ['Director', 'Managing Director', 'CEO', 'Founder', 'Company Administrator', 'HR Head'],
  PUBLIC_LIMITED: ['Director', 'Chairman', 'Managing Director', 'CEO', 'Company Secretary', 'HR Head'],
  SECTION_8: ['Director', 'CEO', 'Chairman', 'Managing Trustee', 'Secretary', 'Executive Director', 'Company Administrator', 'HR Head'],
  TRUST: ['Managing Trustee', 'Trustee', 'Secretary', 'Company Administrator', 'HR Head'],
  SOCIETY: ['Secretary', 'President', 'Treasurer', 'Company Administrator'],
  GOVERNMENT_PSU: ['HR Officer', 'Establishment Officer', 'Company Administrator'],
  COOPERATIVE_SOCIETY: ['Secretary', 'President', 'Treasurer', 'Company Administrator'],
};

export type ModulePermissionDto = {
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export function ownerTitleForLegalEntity(legalEntityType?: string | null): string {
  const options = USER_TYPE_OPTIONS_BY_ENTITY[(legalEntityType || '').toUpperCase()];
  return options?.[0] || 'Owner';
}

export function fullOwnerPermissions(): ModulePermissionDto[] {
  return COMPANY_MODULE_KEYS.map((moduleKey) => ({
    moduleKey,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  }));
}

export function emptyPermissions(): ModulePermissionDto[] {
  return COMPANY_MODULE_KEYS.map((moduleKey) => ({
    moduleKey,
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  }));
}

export function hasModuleAction(
  permissions: ModulePermissionDto[] | null | undefined,
  isCompanyOwner: boolean,
  moduleKey: string,
  action: 'view' | 'create' | 'edit' | 'delete',
): boolean {
  if (isCompanyOwner) return true;
  const row = (permissions || []).find((p) => p.moduleKey === moduleKey);
  if (!row) return false;
  if (action === 'view') return !!row.canView;
  if (action === 'create') return !!row.canCreate;
  if (action === 'edit') return !!row.canEdit;
  if (action === 'delete') return !!row.canDelete;
  return false;
}

export const ROUTE_MODULE_MAP: { prefix: string; moduleKey: CompanyModuleKey }[] = [
  { prefix: '/manage-employees', moduleKey: 'EMPLOYEES' },
  { prefix: '/termination', moduleKey: 'OFFBOARDING' },
  { prefix: '/branches', moduleKey: 'BRANCHES' },
  { prefix: '/departments', moduleKey: 'DEPARTMENTS' },
  { prefix: '/designations', moduleKey: 'DESIGNATIONS' },
  { prefix: '/devices', moduleKey: 'DEVICES' },
  { prefix: '/contractors', moduleKey: 'CONTRACTORS' },
  { prefix: '/contractor-rates', moduleKey: 'CONTRACTOR_RATES' },
  { prefix: '/contractor-payout', moduleKey: 'CONTRACTORS' },
  { prefix: '/work-shifts', moduleKey: 'WORK_SHIFTS' },
  { prefix: '/attendance-policy', moduleKey: 'ATTENDANCE_POLICY' },
  { prefix: '/roster', moduleKey: 'ROSTER' },
  { prefix: '/attendance-regularisation', moduleKey: 'REGULARISATION' },
  { prefix: '/manage-holidays', moduleKey: 'HOLIDAYS' },
  { prefix: '/public-holiday', moduleKey: 'HOLIDAYS' },
  { prefix: '/leave-policy', moduleKey: 'LEAVE_POLICY' },
  { prefix: '/leave-applications', moduleKey: 'LEAVE_APPLICATIONS' },
  { prefix: '/privileged-leave', moduleKey: 'LEAVE_APPLICATIONS' },
  { prefix: '/monthly-salary-cycle', moduleKey: 'PAYROLL' },
  { prefix: '/salary-allowances', moduleKey: 'PAYROLL' },
  { prefix: '/salary-deductions', moduleKey: 'PAYROLL' },
  { prefix: '/monthly-pay-grade', moduleKey: 'PAYROLL' },
  { prefix: '/bonus-setup', moduleKey: 'PAYROLL' },
  { prefix: '/bonus-allocations', moduleKey: 'PAYROLL' },
  { prefix: '/generate-salary', moduleKey: 'PAYROLL' },
  { prefix: '/reimbursement', moduleKey: 'REIMBURSEMENTS' },
  { prefix: '/salary-advance', moduleKey: 'SALARY_ADVANCES' },
  { prefix: '/task-customers', moduleKey: 'TASKS' },
  { prefix: '/task-customer-sites', moduleKey: 'TASKS' },
  { prefix: '/task-projects', moduleKey: 'TASKS' },
  { prefix: '/employee-memo', moduleKey: 'MESSAGING' },
  { prefix: '/attendance-reports', moduleKey: 'REPORTS' },
  { prefix: '/attendance-logs', moduleKey: 'REPORTS' },
  { prefix: '/import-attendance', moduleKey: 'IMPORT_ATTENDANCE' },
  { prefix: '/system-settings', moduleKey: 'SETTINGS' },
  { prefix: '/empRights', moduleKey: 'RIGHTS' },
];
