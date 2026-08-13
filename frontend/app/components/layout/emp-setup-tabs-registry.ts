import { canViewModule, isCompanyOwnerFlag } from "@/lib/companyAccess";

export interface EmpSetupTabItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  iconClassName?: string;
  show?: () => boolean;
}

export interface EmpSetupTab {
  key: string;
  label: string;
  items: EmpSetupTabItem[];
}

export const COMPANY_SETUP_TABS: EmpSetupTab[] = [
  {
    key: "setup",
    label: "Setup",
    items: [
      {
        id: "branches",
        label: "Branches",
        href: "/branches",
        icon: "solar:map-point-wave-bold-duotone",
        iconClassName: "text-cyan-700",
        show: () => canViewModule("BRANCHES"),
      },
      {
        id: "departments",
        label: "Departments",
        href: "/departments",
        icon: "solar:widget-2-bold-duotone",
        iconClassName: "text-sky-700",
        show: () => canViewModule("DEPARTMENTS"),
      },
      {
        id: "devices",
        label: "Attendance Devices",
        href: "/devices",
        icon: "solar:smartphone-bold-duotone",
        iconClassName: "text-slate-700",
        show: () => canViewModule("DEVICES"),
      },
    ],
  },
  {
    key: "tax",
    label: "Tax & Compliances",
    items: [
      {
        id: "company-info",
        label: "Company Information",
        href: "/system-settings/general",
        icon: "solar:buildings-2-bold-duotone",
        iconClassName: "text-gray-700",
        show: () => canViewModule("SETTINGS"),
      },
      {
        id: "registrations",
        label: "Registrations & Certificates",
        href: "/system-settings/compliance",
        icon: "solar:shield-check-bold-duotone",
        iconClassName: "text-emerald-800",
        show: () => canViewModule("SETTINGS"),
      },
    ],
  },
  {
    key: "documents",
    label: "Documents Templates",
    items: [
      {
        id: "document-templates",
        label: "Document Templates",
        href: "/document-templates",
        icon: "solar:document-add-bold-duotone",
        iconClassName: "text-indigo-700",
        show: () => canViewModule("SETTINGS"),
      },
      {
        id: "forms",
        label: "Forms",
        href: "/forms",
        icon: "solar:file-text-bold-duotone",
        iconClassName: "text-teal-700",
        show: () => canViewModule("SETTINGS"),
      },
      {
        id: "email-templates",
        label: "Email Templates",
        href: "/system-settings/email-templates",
        icon: "solar:letter-opened-bold-duotone",
        iconClassName: "text-sky-800",
        show: () => canViewModule("SETTINGS"),
      },
    ],
  },
  {
    key: "advance",
    label: "Advance",
    items: [
      {
        id: "import-attendance",
        label: "Import Attendance",
        href: "/import-attendance",
        icon: "solar:upload-bold-duotone",
        iconClassName: "text-slate-600",
        show: () => canViewModule("IMPORT_ATTENDANCE"),
      },
    ],
  },
];

export const POLICY_SETUP_TABS: EmpSetupTab[] = [
  {
    key: "work",
    label: "Work Policies",
    items: [
      {
        id: "work-shifts",
        label: "Workshift",
        href: "/work-shifts",
        icon: "solar:clock-circle-bold-duotone",
        iconClassName: "text-violet-700",
        show: () => canViewModule("WORK_SHIFTS"),
      },
      {
        id: "attendance-policy",
        label: "Attendance Policy",
        href: "/attendance-policy",
        icon: "solar:document-text-bold-duotone",
        iconClassName: "text-fuchsia-700",
        show: () => canViewModule("ATTENDANCE_POLICY"),
      },
    ],
  },
  {
    key: "leave",
    label: "Leave Policies",
    items: [
      {
        id: "manage-holidays",
        label: "Manage Holidays",
        href: "/manage-holidays",
        icon: "solar:confetti-bold-duotone",
        iconClassName: "text-rose-600",
        show: () => canViewModule("HOLIDAYS"),
      },
      {
        id: "leave-policy",
        label: "Leave Policy",
        href: "/leave-policy",
        icon: "solar:clipboard-list-bold-duotone",
        iconClassName: "text-sky-600",
        show: () => canViewModule("LEAVE_POLICY"),
      },
    ],
  },
  {
    key: "other",
    label: "Other Policy",
    items: [
      {
        id: "it-policy",
        label: "IT Policy",
        href: "/other-policy",
        icon: "solar:shield-keyhole-bold-duotone",
        iconClassName: "text-slate-600",
        show: () => isCompanyOwnerFlag() || canViewModule("SETTINGS"),
      },
    ],
  },
];

export const PAYROLL_SETUP_TABS: EmpSetupTab[] = [
  {
    key: "paygrade",
    label: "Paygrade Setup",
    items: [
      {
        id: "allowances",
        label: "Allowances",
        href: "/salary-allowances",
        icon: "solar:hand-money-bold-duotone",
        iconClassName: "text-teal-600",
        show: () => canViewModule("PAYROLL"),
      },
      {
        id: "deductions",
        label: "Deductions",
        href: "/salary-deductions",
        icon: "solar:bill-list-bold-duotone",
        iconClassName: "text-orange-600",
        show: () => canViewModule("PAYROLL"),
      },
      {
        id: "salary-cycle",
        label: "Salary Cycle",
        href: "/monthly-salary-cycle",
        icon: "solar:calendar-date-bold-duotone",
        iconClassName: "text-emerald-600",
        show: () => canViewModule("PAYROLL"),
      },
      {
        id: "paygrade",
        label: "Paygrade",
        href: "/monthly-pay-grade",
        icon: "solar:tag-price-bold-duotone",
        iconClassName: "text-amber-600",
        show: () => canViewModule("PAYROLL"),
      },
      {
        id: "bonus-setup",
        label: "Bonus Rule",
        href: "/bonus-setup",
        icon: "solar:star-bold-duotone",
        iconClassName: "text-yellow-600",
        show: () => canViewModule("PAYROLL"),
      },
    ],
  },
  {
    key: "compliance",
    label: "Compliance Setup",
    items: [
      {
        id: "epf-setup",
        label: "EPF Setup",
        href: "/pf-compliance",
        icon: "solar:shield-check-bold-duotone",
        iconClassName: "text-emerald-700",
        show: () => canViewModule("PAYROLL"),
      },
      {
        id: "esi-setup",
        label: "ESI Setup",
        href: "/esic-compliance",
        icon: "solar:heart-pulse-bold-duotone",
        iconClassName: "text-rose-700",
        show: () => canViewModule("PAYROLL"),
      },
      {
        id: "tds-setup",
        label: "PT / TDS Setup",
        href: "/pt-compliance",
        icon: "solar:bill-check-bold-duotone",
        iconClassName: "text-indigo-700",
        show: () => canViewModule("PAYROLL"),
      },
    ],
  },
];

export const STATUTORY_REPORTS_TABS: EmpSetupTab[] = [
  {
    key: "challans",
    label: "Statutory Challans",
    items: [
      {
        id: "pf",
        label: "PF Challan",
        href: "/pf-compliance",
        icon: "solar:shield-check-bold-duotone",
        iconClassName: "text-emerald-700",
        show: () => canViewModule("REPORTS") || canViewModule("PAYROLL"),
      },
      {
        id: "esi",
        label: "ESI Challan",
        href: "/esic-compliance",
        icon: "solar:heart-pulse-bold-duotone",
        iconClassName: "text-rose-700",
        show: () => canViewModule("REPORTS") || canViewModule("PAYROLL"),
      },
      {
        id: "pt",
        label: "PT Challan",
        href: "/pt-compliance",
        icon: "solar:bill-check-bold-duotone",
        iconClassName: "text-indigo-700",
        show: () => canViewModule("REPORTS") || canViewModule("PAYROLL"),
      },
    ],
  },
];

export const EMP_SETUP_TABS_REGISTRY: Record<string, EmpSetupTab[]> = {
  "/company-setup": COMPANY_SETUP_TABS,
  "/policy-setup": POLICY_SETUP_TABS,
  "/payroll-setup": PAYROLL_SETUP_TABS,
  "/statutory-reports": STATUTORY_REPORTS_TABS,
};

export function getVisibleSetupTabs(tabs: EmpSetupTab[]): EmpSetupTab[] {
  return tabs
    .map((tab) => ({
      ...tab,
      items: tab.items.filter((item) => (item.show ? item.show() : true)),
    }))
    .filter((tab) => tab.items.length > 0);
}
