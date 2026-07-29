import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";
import { canViewModule, hasCompanyAccessFlag, isCompanyOwnerFlag } from "@/lib/companyAccess";

export type EmpMoreSection = {
  id: string;
  label: string;
  href: string;
  icon: string;
  iconClassName: string;
  managerOnly?: boolean;
  /** Company module key required for canView (owner always passes). */
  moduleKey?: string;
  /** Only company owner (or RIGHTS viewers for rights entry). */
  ownerOrRightsOnly?: boolean;
  /** Optional group heading in More grid. */
  group?: "team" | "admin";
  show?: () => boolean;
};

const always = () => true;

/**
 * More grid for employees:
 * - Team tiles (managers)
 * - Company-admin modules for owners / rights holders (mirrors HRMS_NAVIGATION company sections)
 * Self-service tiles live under My Profile / sidebar — not duplicated here.
 */
export const EMP_MORE_SECTIONS: EmpMoreSection[] = [
  // ── Manager (team) ──
  {
    id: "promotions",
    label: "Promotions and Transfers",
    href: "/empTeam/promotions",
    icon: "solar:transfer-horizontal-bold-duotone",
    iconClassName: "text-indigo-600",
    managerOnly: true,
    group: "team",
  },
  {
    id: "my-team",
    label: "My Team",
    href: "/empTeam/my-team",
    icon: "solar:users-group-two-rounded-bold-duotone",
    iconClassName: "text-violet-500",
    managerOnly: true,
    group: "team",
  },
  {
    id: "team-approvals",
    label: "Team Approvals",
    href: "/empTeam/approvals",
    icon: "solar:clipboard-check-bold-duotone",
    iconClassName: "text-emerald-600",
    managerOnly: true,
    group: "team",
  },
  {
    id: "company-overview",
    label: "My Company",
    href: "/empCompany",
    icon: "solar:buildings-2-bold-duotone",
    iconClassName: "text-slate-600",
    managerOnly: true,
    group: "team",
  },

  // ── Company admin — Overview ──
  {
    id: "company-dashboard",
    label: "Company Dashboard",
    href: "/empCompanyDashboard",
    icon: "solar:chart-square-bold-duotone",
    iconClassName: "text-indigo-700",
    group: "admin",
    show: () => hasCompanyAccessFlag(),
  },

  // ── Company Setup ──
  {
    id: "admin-branches",
    label: "Branches",
    href: "/branches",
    icon: "solar:map-point-wave-bold-duotone",
    iconClassName: "text-cyan-700",
    moduleKey: "BRANCHES",
    group: "admin",
  },
  {
    id: "admin-departments",
    label: "Departments",
    href: "/departments",
    icon: "solar:widget-2-bold-duotone",
    iconClassName: "text-sky-700",
    moduleKey: "DEPARTMENTS",
    group: "admin",
  },
  {
    id: "admin-designations",
    label: "Designations",
    href: "/designations",
    icon: "solar:medal-ribbon-bold-duotone",
    iconClassName: "text-amber-700",
    moduleKey: "DESIGNATIONS",
    group: "admin",
  },
  {
    id: "admin-devices",
    label: "Attendance Devices",
    href: "/devices",
    icon: "solar:smartphone-bold-duotone",
    iconClassName: "text-slate-700",
    moduleKey: "DEVICES",
    group: "admin",
  },

  // ── Workforce ──
  {
    id: "admin-employees",
    label: "Employees",
    href: "/manage-employees",
    icon: "solar:users-group-rounded-bold-duotone",
    iconClassName: "text-blue-700",
    moduleKey: "EMPLOYEES",
    group: "admin",
  },
  {
    id: "admin-offboarding",
    label: "Off Boarding",
    href: "/termination",
    icon: "solar:user-minus-bold-duotone",
    iconClassName: "text-rose-700",
    moduleKey: "OFFBOARDING",
    group: "admin",
  },

  // ── Contractor ──
  {
    id: "admin-contractors",
    label: "Contractors",
    href: "/contractors",
    icon: "solar:case-bold-duotone",
    iconClassName: "text-orange-700",
    moduleKey: "CONTRACTORS",
    group: "admin",
  },
  {
    id: "admin-contractor-rates",
    label: "Contractor Rates",
    href: "/contractor-rates",
    icon: "solar:wad-of-money-bold-duotone",
    iconClassName: "text-lime-700",
    moduleKey: "CONTRACTOR_RATES",
    group: "admin",
  },
  {
    id: "admin-contractor-payout",
    label: "Contractor Payouts",
    href: "/contractor-payout",
    icon: "solar:card-transfer-bold-duotone",
    iconClassName: "text-green-700",
    moduleKey: "CONTRACTORS",
    group: "admin",
  },

  // ── Task Management ──
  {
    id: "admin-customers",
    label: "Customers",
    href: "/task-customers",
    icon: "solar:users-group-two-rounded-bold-duotone",
    iconClassName: "text-violet-700",
    moduleKey: "TASKS",
    group: "admin",
    show: () => TASK_MANAGEMENT_ENABLED,
  },
  {
    id: "admin-sites",
    label: "Sites / Branches",
    href: "/task-customer-sites",
    icon: "solar:map-point-bold-duotone",
    iconClassName: "text-fuchsia-700",
    moduleKey: "TASKS",
    group: "admin",
    show: () => TASK_MANAGEMENT_ENABLED,
  },
  {
    id: "admin-tasks",
    label: "Tasks / Projects",
    href: "/task-projects",
    icon: "solar:checklist-minimalistic-bold-duotone",
    iconClassName: "text-rose-600",
    moduleKey: "TASKS",
    group: "admin",
    show: () => TASK_MANAGEMENT_ENABLED,
  },

  // ── Shift & Attendance ──
  {
    id: "admin-work-shifts",
    label: "Work Shifts",
    href: "/work-shifts",
    icon: "solar:clock-circle-bold-duotone",
    iconClassName: "text-violet-700",
    moduleKey: "WORK_SHIFTS",
    group: "admin",
  },
  {
    id: "admin-attendance-policy",
    label: "Attendance Policy",
    href: "/attendance-policy",
    icon: "solar:document-text-bold-duotone",
    iconClassName: "text-fuchsia-700",
    moduleKey: "ATTENDANCE_POLICY",
    group: "admin",
  },
  {
    id: "admin-roster",
    label: "Workshift Roster",
    href: "/roster",
    icon: "solar:calendar-bold-duotone",
    iconClassName: "text-pink-700",
    moduleKey: "ROSTER",
    group: "admin",
  },
  {
    id: "admin-regularisation",
    label: "Regularisation",
    href: "/attendance-regularisation",
    icon: "solar:restart-bold-duotone",
    iconClassName: "text-teal-700",
    moduleKey: "REGULARISATION",
    group: "admin",
  },

  // ── Leave Policy ──
  {
    id: "admin-holidays",
    label: "Manage Holidays",
    href: "/manage-holidays",
    icon: "solar:confetti-bold-duotone",
    iconClassName: "text-rose-600",
    moduleKey: "HOLIDAYS",
    group: "admin",
  },
  {
    id: "admin-public-holiday",
    label: "Public Holiday",
    href: "/public-holiday",
    icon: "solar:calendar-search-bold-duotone",
    iconClassName: "text-cyan-600",
    moduleKey: "HOLIDAYS",
    group: "admin",
  },
  {
    id: "admin-leave-policy",
    label: "Leave Policy",
    href: "/leave-policy",
    icon: "solar:clipboard-list-bold-duotone",
    iconClassName: "text-sky-600",
    moduleKey: "LEAVE_POLICY",
    group: "admin",
  },

  // ── Payroll Policy ──
  {
    id: "admin-salary-cycle",
    label: "Salary Cycle",
    href: "/monthly-salary-cycle",
    icon: "solar:calendar-date-bold-duotone",
    iconClassName: "text-emerald-600",
    moduleKey: "PAYROLL",
    group: "admin",
  },
  {
    id: "admin-allowances",
    label: "Allowances",
    href: "/salary-allowances",
    icon: "solar:hand-money-bold-duotone",
    iconClassName: "text-teal-600",
    moduleKey: "PAYROLL",
    group: "admin",
  },
  {
    id: "admin-deductions",
    label: "Deductions",
    href: "/salary-deductions",
    icon: "solar:bill-list-bold-duotone",
    iconClassName: "text-orange-600",
    moduleKey: "PAYROLL",
    group: "admin",
  },
  {
    id: "admin-paygrade",
    label: "Paygrade",
    href: "/monthly-pay-grade",
    icon: "solar:tag-price-bold-duotone",
    iconClassName: "text-amber-600",
    moduleKey: "PAYROLL",
    group: "admin",
  },
  {
    id: "admin-bonus-rule",
    label: "Bonus Rule",
    href: "/bonus-setup",
    icon: "solar:star-bold-duotone",
    iconClassName: "text-yellow-600",
    moduleKey: "PAYROLL",
    group: "admin",
  },

  // ── Payroll ──
  {
    id: "admin-bonus-allocations",
    label: "Bonus Allocations",
    href: "/bonus-allocations",
    icon: "solar:gift-bold-duotone",
    iconClassName: "text-pink-600",
    moduleKey: "PAYROLL",
    group: "admin",
  },
  {
    id: "admin-advances",
    label: "Salary Advances",
    href: "/salary-advance",
    icon: "solar:hand-money-bold-duotone",
    iconClassName: "text-green-700",
    moduleKey: "SALARY_ADVANCES",
    group: "admin",
  },
  {
    id: "admin-reimbursements",
    label: "Reimbursements",
    href: "/reimbursement",
    icon: "solar:wallet-money-bold-duotone",
    iconClassName: "text-teal-600",
    moduleKey: "REIMBURSEMENTS",
    group: "admin",
  },
  {
    id: "admin-payroll",
    label: "Run Payroll",
    href: "/generate-salary",
    icon: "solar:calculator-bold-duotone",
    iconClassName: "text-emerald-700",
    moduleKey: "PAYROLL",
    group: "admin",
  },

  // ── Leave Management ──
  {
    id: "admin-leave-apps",
    label: "Leave Applications",
    href: "/leave-applications",
    icon: "solar:letter-bold-duotone",
    iconClassName: "text-blue-600",
    moduleKey: "LEAVE_APPLICATIONS",
    group: "admin",
  },
  {
    id: "admin-privileged-leave",
    label: "Privileged Leave",
    href: "/privileged-leave",
    icon: "solar:shield-user-bold-duotone",
    iconClassName: "text-indigo-600",
    moduleKey: "LEAVE_APPLICATIONS",
    group: "admin",
  },

  // ── Messaging ──
  {
    id: "admin-messaging",
    label: "Internal Messaging",
    href: "/employee-memo",
    icon: "solar:chat-round-line-bold-duotone",
    iconClassName: "text-indigo-600",
    moduleKey: "MESSAGING",
    group: "admin",
  },

  // ── Reports ──
  {
    id: "admin-reports",
    label: "Attendance Reports",
    href: "/attendance-reports",
    icon: "solar:graph-up-bold-duotone",
    iconClassName: "text-blue-800",
    moduleKey: "REPORTS",
    group: "admin",
  },
  {
    id: "admin-attendance-logs",
    label: "Attendance Logs",
    href: "/attendance-logs",
    icon: "solar:history-bold-duotone",
    iconClassName: "text-slate-700",
    moduleKey: "REPORTS",
    group: "admin",
  },

  // ── Settings ──
  {
    id: "admin-import-attendance",
    label: "Import Attendance",
    href: "/import-attendance",
    icon: "solar:upload-bold-duotone",
    iconClassName: "text-slate-600",
    moduleKey: "IMPORT_ATTENDANCE",
    group: "admin",
  },
  {
    id: "admin-settings-general",
    label: "General Settings",
    href: "/system-settings/general",
    icon: "solar:settings-bold-duotone",
    iconClassName: "text-gray-700",
    moduleKey: "SETTINGS",
    group: "admin",
  },
  {
    id: "admin-settings-compliance",
    label: "Compliance",
    href: "/system-settings/compliance",
    icon: "solar:shield-check-bold-duotone",
    iconClassName: "text-emerald-800",
    moduleKey: "SETTINGS",
    group: "admin",
  },
  {
    id: "admin-settings-email",
    label: "Email Templates",
    href: "/system-settings/email-templates",
    icon: "solar:letter-opened-bold-duotone",
    iconClassName: "text-sky-800",
    moduleKey: "SETTINGS",
    group: "admin",
  },
  {
    id: "rights",
    label: "Rights & Permissions",
    href: "/empRights",
    icon: "solar:shield-keyhole-bold-duotone",
    iconClassName: "text-amber-800",
    ownerOrRightsOnly: true,
    group: "admin",
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
  key: string;
  title: string;
  items: EmpMoreSection[];
}[] {
  const order: Array<{ key: EmpMoreSection["group"]; title: string }> = [
    { key: "team", title: "Team" },
    { key: "admin", title: "Company admin" },
  ];
  return order
    .map(({ key, title }) => ({
      key: key || "admin",
      title,
      items: sections.filter((s) => (s.group || "admin") === key),
    }))
    .filter((g) => g.items.length > 0);
}
