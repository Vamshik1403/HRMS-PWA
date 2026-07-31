import { canViewModule, isCompanyOwnerFlag } from "@/lib/companyAccess";

export type EmpMoreGroupKey =
  | "organization"
  | "employee"
  | "contractor"
  | "attendance"
  | "leave"
  | "payroll"
  | "reports"
  | "settings";

export type EmpMoreSection = {
  id: string;
  label: string;
  href: string;
  icon: string;
  iconClassName: string;
  /** Optional one-line card description for the More explorer. */
  description?: string;
  managerOnly?: boolean;
  /** Company module key required for canView (owner always passes). */
  moduleKey?: string;
  /** Only company owner (or RIGHTS viewers for rights entry). */
  ownerOrRightsOnly?: boolean;
  /** Optional group heading in More grid. */
  group?: EmpMoreGroupKey;
  show?: () => boolean;
};

const always = () => true;

/**
 * More grid for employees:
 * - Company-admin modules for owners / rights holders (mirrors HRMS_NAVIGATION company sections)
 * Team, Tasks, Customers, IM live in the sidebar — not duplicated here.
 */
export const EMP_MORE_SECTIONS: EmpMoreSection[] = [
  // ── Organization setup ──
  {
    id: "admin-branches",
    label: "Branches",
    href: "/branches",
    icon: "solar:map-point-wave-bold-duotone",
    iconClassName: "text-cyan-700",
    moduleKey: "BRANCHES",
    group: "organization",
  },
  {
    id: "admin-departments",
    label: "Departments",
    href: "/departments",
    icon: "solar:widget-2-bold-duotone",
    iconClassName: "text-sky-700",
    moduleKey: "DEPARTMENTS",
    group: "organization",
  },
  {
    id: "admin-designations",
    label: "Designations",
    href: "/designations",
    icon: "solar:medal-ribbon-bold-duotone",
    iconClassName: "text-amber-700",
    moduleKey: "DESIGNATIONS",
    group: "organization",
  },
  {
    id: "admin-devices",
    label: "Attendance Devices",
    href: "/devices",
    icon: "solar:smartphone-bold-duotone",
    iconClassName: "text-slate-700",
    moduleKey: "DEVICES",
    group: "organization",
  },

  // ── Employee management ──
  {
    id: "admin-employees",
    label: "Employees",
    href: "/manage-employees",
    icon: "solar:users-group-rounded-bold-duotone",
    iconClassName: "text-blue-700",
    moduleKey: "EMPLOYEES",
    group: "employee",
  },
  {
    id: "admin-offboarding",
    label: "Off Boarding",
    href: "/termination",
    icon: "solar:user-minus-bold-duotone",
    iconClassName: "text-rose-700",
    moduleKey: "OFFBOARDING",
    group: "employee",
  },
  {
    id: "admin-regularisation",
    label: "Regularisation",
    href: "/attendance-regularisation",
    icon: "solar:restart-bold-duotone",
    iconClassName: "text-teal-700",
    moduleKey: "REGULARISATION",
    group: "employee",
  },
  {
    id: "admin-leave-apps",
    label: "Leave Applications",
    href: "/leave-applications",
    icon: "solar:letter-bold-duotone",
    iconClassName: "text-blue-600",
    moduleKey: "LEAVE_APPLICATIONS",
    group: "employee",
  },
  {
    id: "admin-privileged-leave",
    label: "Privileged Leave",
    href: "/privileged-leave",
    icon: "solar:shield-user-bold-duotone",
    iconClassName: "text-indigo-600",
    moduleKey: "LEAVE_APPLICATIONS",
    group: "employee",
  },
  {
    id: "admin-roster",
    label: "Workshift Roster",
    href: "/roster",
    icon: "solar:calendar-bold-duotone",
    iconClassName: "text-pink-700",
    moduleKey: "ROSTER",
    group: "employee",
  },

  // ── Contractor management ──
  {
    id: "admin-contractors",
    label: "Contractors",
    href: "/contractors",
    icon: "solar:case-bold-duotone",
    iconClassName: "text-orange-700",
    moduleKey: "CONTRACTORS",
    group: "contractor",
  },
  {
    id: "admin-contractor-rates",
    label: "Contractor Rates",
    href: "/contractor-rates",
    icon: "solar:wad-of-money-bold-duotone",
    iconClassName: "text-lime-700",
    moduleKey: "CONTRACTOR_RATES",
    group: "contractor",
  },
  {
    id: "admin-contractor-payout",
    label: "Contractor Payouts",
    href: "/contractor-payout",
    icon: "solar:card-transfer-bold-duotone",
    iconClassName: "text-green-700",
    moduleKey: "CONTRACTORS",
    group: "contractor",
  },

  // ── Work policy (shifts & attendance policy) ──
  {
    id: "admin-work-shifts",
    label: "Work Shifts",
    href: "/work-shifts",
    icon: "solar:clock-circle-bold-duotone",
    iconClassName: "text-violet-700",
    moduleKey: "WORK_SHIFTS",
    group: "attendance",
  },
  {
    id: "admin-attendance-policy",
    label: "Attendance Policy",
    href: "/attendance-policy",
    icon: "solar:document-text-bold-duotone",
    iconClassName: "text-fuchsia-700",
    moduleKey: "ATTENDANCE_POLICY",
    group: "attendance",
  },

  // ── Leave policy ──
  {
    id: "admin-holidays",
    label: "Manage Holidays",
    href: "/manage-holidays",
    icon: "solar:confetti-bold-duotone",
    iconClassName: "text-rose-600",
    moduleKey: "HOLIDAYS",
    group: "leave",
  },
  {
    id: "admin-public-holiday",
    label: "Public Holiday",
    href: "/public-holiday",
    icon: "solar:calendar-search-bold-duotone",
    iconClassName: "text-cyan-600",
    moduleKey: "HOLIDAYS",
    group: "leave",
  },
  {
    id: "admin-leave-policy",
    label: "Leave Policy",
    href: "/leave-policy",
    icon: "solar:clipboard-list-bold-duotone",
    iconClassName: "text-sky-600",
    moduleKey: "LEAVE_POLICY",
    group: "leave",
  },

  // ── Payroll ──
  {
    id: "admin-salary-cycle",
    label: "Salary Cycle",
    href: "/monthly-salary-cycle",
    icon: "solar:calendar-date-bold-duotone",
    iconClassName: "text-emerald-600",
    moduleKey: "PAYROLL",
    group: "organization",
  },
  {
    id: "admin-allowances",
    label: "Allowances",
    href: "/salary-allowances",
    icon: "solar:hand-money-bold-duotone",
    iconClassName: "text-teal-600",
    moduleKey: "PAYROLL",
    group: "organization",
  },
  {
    id: "admin-deductions",
    label: "Deductions",
    href: "/salary-deductions",
    icon: "solar:bill-list-bold-duotone",
    iconClassName: "text-orange-600",
    moduleKey: "PAYROLL",
    group: "organization",
  },
  {
    id: "admin-paygrade",
    label: "Paygrade",
    href: "/monthly-pay-grade",
    icon: "solar:tag-price-bold-duotone",
    iconClassName: "text-amber-600",
    moduleKey: "PAYROLL",
    group: "payroll",
  },
  {
    id: "admin-bonus-rule",
    label: "Bonus Rule",
    href: "/bonus-setup",
    icon: "solar:star-bold-duotone",
    iconClassName: "text-yellow-600",
    moduleKey: "PAYROLL",
    group: "payroll",
  },
  {
    id: "admin-bonus-allocations",
    label: "Bonus Allocations",
    href: "/bonus-allocations",
    icon: "solar:gift-bold-duotone",
    iconClassName: "text-pink-600",
    moduleKey: "PAYROLL",
    group: "payroll",
  },
  {
    id: "admin-advances",
    label: "Salary Advances",
    href: "/salary-advance",
    icon: "solar:hand-money-bold-duotone",
    iconClassName: "text-green-700",
    moduleKey: "SALARY_ADVANCES",
    group: "payroll",
  },
  {
    id: "admin-reimbursements",
    label: "Reimbursements",
    href: "/reimbursement",
    icon: "solar:wallet-money-bold-duotone",
    iconClassName: "text-teal-600",
    moduleKey: "REIMBURSEMENTS",
    group: "payroll",
  },
  {
    id: "admin-payroll",
    label: "Run Payroll",
    href: "/generate-salary",
    icon: "solar:calculator-bold-duotone",
    iconClassName: "text-emerald-700",
    moduleKey: "PAYROLL",
    group: "payroll",
  },

  // ── Reports ──
  {
    id: "admin-reports",
    label: "Attendance Reports",
    href: "/attendance-reports",
    icon: "solar:graph-up-bold-duotone",
    iconClassName: "text-blue-800",
    moduleKey: "REPORTS",
    group: "reports",
  },
  {
    id: "admin-attendance-logs",
    label: "Attendance Logs",
    href: "/attendance-logs",
    icon: "solar:history-bold-duotone",
    iconClassName: "text-slate-700",
    moduleKey: "REPORTS",
    group: "reports",
  },

  // ── Administration ──
  {
    id: "admin-import-attendance",
    label: "Import Attendance",
    href: "/import-attendance",
    icon: "solar:upload-bold-duotone",
    iconClassName: "text-slate-600",
    moduleKey: "IMPORT_ATTENDANCE",
    group: "settings",
  },
  {
    id: "admin-settings-general",
    label: "General Settings",
    href: "/system-settings/general",
    icon: "solar:settings-bold-duotone",
    iconClassName: "text-gray-700",
    moduleKey: "SETTINGS",
    group: "settings",
  },
  {
    id: "admin-settings-compliance",
    label: "Compliance",
    href: "/system-settings/compliance",
    icon: "solar:shield-check-bold-duotone",
    iconClassName: "text-emerald-800",
    moduleKey: "SETTINGS",
    group: "settings",
  },
  {
    id: "admin-settings-email",
    label: "Email Templates",
    href: "/system-settings/email-templates",
    icon: "solar:letter-opened-bold-duotone",
    iconClassName: "text-sky-800",
    moduleKey: "SETTINGS",
    group: "settings",
  },
  {
    id: "rights",
    label: "Rights & Permissions",
    href: "/empRights",
    icon: "solar:shield-keyhole-bold-duotone",
    iconClassName: "text-amber-800",
    ownerOrRightsOnly: true,
    group: "settings",
  },
];

export function getVisibleEmpMoreSections(isManager: boolean): EmpMoreSection[] {
  return EMP_MORE_SECTIONS.filter((section) => {
    if (section.managerOnly && !isManager) return false;
    if (section.ownerOrRightsOnly) {
      return isCompanyOwnerFlag() || canViewModule("RIGHTS");
    }
    if (section.moduleKey) {
      if (!(section.show ?? always)()) return false;
      return canViewModule(section.moduleKey);
    }
    return (section.show ?? always)();
  });
}

export function groupEmpMoreSections(sections: EmpMoreSection[]): {
  key: EmpMoreGroupKey;
  title: string;
  description: string;
  items: EmpMoreSection[];
}[] {
  const order: Array<{ key: EmpMoreGroupKey; title: string; description: string }> = [
    { key: "organization", title: "Organization Setup", description: "Manage your organization structure and settings." },
    { key: "employee", title: "Employee Management", description: "Manage employee records and lifecycle." },
    { key: "contractor", title: "Contractor Management", description: "Manage contractors, rates, and payouts." },
    { key: "attendance", title: "Work Policy", description: "Work shifts and attendance policies." },
    { key: "leave", title: "Leave Policy", description: "Leave policies, holidays, and public holidays." },
    { key: "payroll", title: "Payroll", description: "Salary setup, advances, reimbursements, and run payroll." },
    { key: "reports", title: "Reports", description: "Attendance reports and logs." },
    { key: "settings", title: "Administration", description: "Imports, system settings, templates, and permissions." },
  ];
  return order
    .map(({ key, title, description }) => ({
      key,
      title,
      description,
      items: sections.filter((s) => (s.group || "organization") === key),
    }))
    .filter((g) => g.items.length > 0);
}

/** Category icons for the More module explorer tabs. */
export const EMP_MORE_GROUP_ICONS: Record<EmpMoreGroupKey, string> = {
  organization: "solar:buildings-2-bold-duotone",
  employee: "solar:user-id-bold-duotone",
  contractor: "solar:handshake-bold-duotone",
  attendance: "solar:clock-circle-bold-duotone",
  leave: "solar:calendar-bold-duotone",
  payroll: "solar:wallet-money-bold-duotone",
  reports: "solar:graph-up-bold-duotone",
  settings: "solar:settings-bold-duotone",
};

export function moreModuleDescription(section: EmpMoreSection): string {
  if (section.description) return section.description;
  const defaults: Record<string, string> = {
    "admin-branches": "Manage company branches",
    "admin-departments": "Manage departments",
    "admin-designations": "Manage job titles",
    "admin-devices": "Configure biometric devices",
    "admin-holidays": "Manage holidays",
    "admin-roster": "Plan and assign workshift rosters",
    "admin-import-attendance": "Import attendance records",
  };
  return defaults[section.id] || `Open ${section.label}`;
}
