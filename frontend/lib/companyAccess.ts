/** Company owner / granted module rights for employee-login operators. */

export type ModulePermission = {
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type ModuleAction = "view" | "create" | "edit" | "delete";

export const COMPANY_ACCESS_KEY = "openhrmCompanyAccess";

export type CompanyAccessSnapshot = {
  isCompanyOwner: boolean;
  ownerTitle?: string | null;
  hasAnyCompanyAccess: boolean;
  permissions: ModulePermission[];
};

export function readCompanyAccess(): CompanyAccessSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COMPANY_ACCESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CompanyAccessSnapshot;
  } catch {
    return null;
  }
}

export function setCompanyAccess(snapshot: CompanyAccessSnapshot | null) {
  if (typeof window === "undefined") return;
  if (!snapshot || !snapshot.hasAnyCompanyAccess) {
    localStorage.removeItem(COMPANY_ACCESS_KEY);
    return;
  }
  localStorage.setItem(COMPANY_ACCESS_KEY, JSON.stringify(snapshot));
}

export function clearCompanyAccess() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(COMPANY_ACCESS_KEY);
}

export function persistCompanyAccessFromUser(user: any): CompanyAccessSnapshot | null {
  if (!user || (user.role !== "EMPLOYEE" && user.type !== "employee")) {
    clearCompanyAccess();
    return null;
  }
  const isCompanyOwner = !!(user.isCompanyOwner || user.employee?.isCompanyOwner);
  const permissions: ModulePermission[] = Array.isArray(user.permissions)
    ? user.permissions
    : [];
  const hasAnyCompanyAccess =
    !!user.hasAnyCompanyAccess ||
    isCompanyOwner ||
    permissions.some((p) => p.canView || p.canCreate || p.canEdit || p.canDelete);

  const snapshot: CompanyAccessSnapshot = {
    isCompanyOwner,
    ownerTitle: user.ownerTitle ?? user.employee?.ownerTitle ?? null,
    hasAnyCompanyAccess,
    permissions,
  };
  setCompanyAccess(snapshot);
  return snapshot;
}

export function hasCompanyAccessFlag(): boolean {
  const snap = readCompanyAccess();
  return !!snap?.hasAnyCompanyAccess;
}

export function isCompanyOwnerFlag(): boolean {
  return !!readCompanyAccess()?.isCompanyOwner;
}

export function canModuleAction(moduleKey: string, action: ModuleAction): boolean {
  const snap = readCompanyAccess();
  if (!snap?.hasAnyCompanyAccess) return false;
  if (snap.isCompanyOwner) return true;
  const row = snap.permissions.find((p) => p.moduleKey === moduleKey);
  if (!row) return false;
  if (action === "view") return !!row.canView;
  if (action === "create") return !!row.canCreate;
  if (action === "edit") return !!row.canEdit;
  if (action === "delete") return !!row.canDelete;
  return false;
}

export function canViewModule(moduleKey: string): boolean {
  return canModuleAction(moduleKey, "view");
}

/** Owner or granted create/edit/delete on a company module (for Add/Edit UI). */
export function hasModuleWriteAccess(moduleKey: string): boolean {
  if (isCompanyOwnerFlag()) return true;
  return (
    canModuleAction(moduleKey, "create") ||
    canModuleAction(moduleKey, "edit") ||
    canModuleAction(moduleKey, "delete")
  );
}

/** Map admin route → module key (mirrors backend ROUTE_MODULE_MAP). */
export const ROUTE_MODULE_MAP: { prefix: string; moduleKey: string }[] = [
  { prefix: "/manage-employees", moduleKey: "EMPLOYEES" },
  { prefix: "/termination", moduleKey: "OFFBOARDING" },
  { prefix: "/branches", moduleKey: "BRANCHES" },
  { prefix: "/departments", moduleKey: "DEPARTMENTS" },
  { prefix: "/designations", moduleKey: "DESIGNATIONS" },
  { prefix: "/devices", moduleKey: "DEVICES" },
  { prefix: "/contractors", moduleKey: "CONTRACTORS" },
  { prefix: "/contractor-rates", moduleKey: "CONTRACTOR_RATES" },
  { prefix: "/contractor-payout", moduleKey: "CONTRACTORS" },
  { prefix: "/work-shifts", moduleKey: "WORK_SHIFTS" },
  { prefix: "/attendance-policy", moduleKey: "ATTENDANCE_POLICY" },
  { prefix: "/roster", moduleKey: "ROSTER" },
  { prefix: "/attendance-regularisation", moduleKey: "REGULARISATION" },
  { prefix: "/manage-holidays", moduleKey: "HOLIDAYS" },
  { prefix: "/public-holiday", moduleKey: "HOLIDAYS" },
  { prefix: "/leave-policy", moduleKey: "LEAVE_POLICY" },
  { prefix: "/leave-applications", moduleKey: "LEAVE_APPLICATIONS" },
  { prefix: "/privileged-leave", moduleKey: "LEAVE_APPLICATIONS" },
  { prefix: "/monthly-salary-cycle", moduleKey: "PAYROLL" },
  { prefix: "/salary-allowances", moduleKey: "PAYROLL" },
  { prefix: "/salary-deductions", moduleKey: "PAYROLL" },
  { prefix: "/monthly-pay-grade", moduleKey: "PAYROLL" },
  { prefix: "/bonus-setup", moduleKey: "PAYROLL" },
  { prefix: "/bonus-allocations", moduleKey: "PAYROLL" },
  { prefix: "/generate-salary", moduleKey: "PAYROLL" },
  { prefix: "/reimbursement", moduleKey: "REIMBURSEMENTS" },
  { prefix: "/salary-advance", moduleKey: "SALARY_ADVANCES" },
  { prefix: "/task-customers", moduleKey: "TASKS" },
  { prefix: "/task-customer-sites", moduleKey: "TASKS" },
  { prefix: "/task-projects", moduleKey: "TASKS" },
  { prefix: "/employee-memo", moduleKey: "MESSAGING" },
  { prefix: "/attendance-reports", moduleKey: "REPORTS" },
  { prefix: "/attendance-logs", moduleKey: "REPORTS" },
  { prefix: "/import-attendance", moduleKey: "IMPORT_ATTENDANCE" },
  { prefix: "/system-settings", moduleKey: "SETTINGS" },
  { prefix: "/empRights", moduleKey: "RIGHTS" },
];

export function moduleKeyForPath(pathname: string): string | null {
  const hit = ROUTE_MODULE_MAP.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return hit?.moduleKey ?? null;
}

export const LEGAL_ENTITY_OPTIONS = [
  { value: "PRIVATE_LIMITED", label: "Private Limited" },
  { value: "PUBLIC_LIMITED", label: "Public Limited" },
  { value: "SOLE_PROPRIETORSHIP", label: "Sole Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "LLP", label: "LLP" },
  { value: "OPC", label: "OPC" },
  { value: "OTHER", label: "Other" },
] as const;

export function ownerTitleForLegalEntity(legalEntityType?: string | null): string {
  switch ((legalEntityType || "").toUpperCase()) {
    case "SOLE_PROPRIETORSHIP":
      return "Proprietor";
    case "PARTNERSHIP":
      return "Partner";
    case "LLP":
      return "Designated Partner";
    case "PRIVATE_LIMITED":
    case "PUBLIC_LIMITED":
      return "CEO";
    case "OPC":
      return "Director";
    default:
      return "Owner";
  }
}
