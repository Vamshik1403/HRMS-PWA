import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  Settings2,
  FileClock,
  Calendar,
  CalendarCheck2,
  GitBranch,
  Wallet,
  BadgeCheck,
  Fingerprint,
  Briefcase,
  ClipboardList,
  MessageSquare,
  UserCog,
  Database,
  CreditCard,
  FileText,
  type LucideIcon,
  Building,
} from "lucide-react";
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";
import {
  canViewModule,
  hasCompanyAccessFlag,
  isCompanyAdminLikeRole,
  moduleKeyForPath,
} from "@/lib/companyAccess";
import { isProductHrefAllowed } from "@/lib/productAccess";

export interface NavContext {
  role: string;
  isSuperAdmin: boolean;
  isServiceProvider: boolean;
  isCompanyAdmin: boolean;
  isAdmin: boolean;
  isBranchAdmin: boolean;
  isDesktopManager: boolean;
  canAccessFullHrSections: boolean;
  canSeeCompanySetupSections: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  show?: (ctx: NavContext) => boolean;
}

export interface NavGroup {
  label: string;
  show?: (ctx: NavContext) => boolean;
  items: NavItem[];
}

export function buildNavContext(user: any, desktopManager: boolean): NavContext {
  const role = String(user?.role || "").toUpperCase();

  const isSuperAdmin = role === "SUPERADMIN";
  const isServiceProvider = role === "SERVICE_PROVIDER";
  const isCompanyOperator =
    isCompanyAdminLikeRole(role) ||
    (role === "EMPLOYEE" && hasCompanyAccessFlag());
  const isCompanyAdmin = isCompanyOperator;
  const isAdmin = role === "ADMIN";
  const isBranchAdmin = role === "BRANCH_ADMIN";
  const isDesktopManager = desktopManager && role === "EMPLOYEE";

  const canAccessFullHrSections =
    (isCompanyAdmin || isBranchAdmin || isDesktopManager) && !isAdmin;

  const canSeeCompanySetupSections =
    isCompanyAdmin || isAdmin || isBranchAdmin || isDesktopManager;

  return {
    role,
    isSuperAdmin,
    isServiceProvider,
    isCompanyAdmin,
    isAdmin,
    isBranchAdmin,
    isDesktopManager,
    canAccessFullHrSections,
    canSeeCompanySetupSections,
  };
}

const always = () => true;

export const HRMS_NAVIGATION: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/superdashboard",
        icon: LayoutDashboard,
        show: (c) => c.isSuperAdmin,
      },
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        show: (c) => !c.isSuperAdmin && !isCompanyAdminLikeRole(c.role),
      },
    ],
  },
  {
    label: "My Company",
    show: (c) => isCompanyAdminLikeRole(c.role),
    items: [
      { label: "My Company", href: "/my-company", icon: Building2, show: always },
    ],
  },
  {
    label: "System",
    show: (c) => c.isSuperAdmin || c.isServiceProvider,
    items: [
      { label: "Service Provider", href: "/service-providers", icon: Building2, show: () => false },
      { label: "Tenants", href: "/company", icon: Building2, show: always },
    ],
  },

  {
    label: "Company Setup",
    show: (c) => c.canSeeCompanySetupSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Tenants", href: "/company", icon: Building2, show: (c) => !c.isCompanyAdmin },
      { label: "Branches", href: "/branches", icon: GitBranch, show: always },
      { label: "Departments", href: "/departments", icon: Building, show: always },
      { label: "Designations", href: "/designations", icon: BadgeCheck, show: always },
      { label: "Attendance Devices", href: "/devices", icon: Fingerprint, show: always },
    ],
  },
  {
    label: "Workforce",
    show: (c) => c.canSeeCompanySetupSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Employees", href: "/manage-employees", icon: Users, show: always },
      { label: "Off Boarding", href: "/termination", icon: UserCog, show: always },
    ],
  },
  {
    label: "Contractor",
    show: (c) => c.canAccessFullHrSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Contractors", href: "/contractors", icon: Briefcase, show: always },
      { label: "Contractor Rates", href: "/contractor-rates", icon: Wallet, show: always },
    ],
  },
  {
    label: "Task Management",
    show: (c) =>
      TASK_MANAGEMENT_ENABLED && (c.isCompanyAdmin || c.isDesktopManager) && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Customers", href: "/task-customers", icon: ClipboardList, show: always },
      { label: "Sites / Branches", href: "/task-customer-sites", icon: GitBranch, show: always },
      { label: "Tasks / Projects", href: "/task-projects", icon: ClipboardList, show: always },
    ],
  },
  {
    label: "Shift & Attendance",
    show: (c) =>
      (c.isCompanyAdmin || c.isBranchAdmin || c.isDesktopManager) &&
      !c.isAdmin &&
      !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Work Shifts", href: "/work-shifts", icon: CalendarCheck2, show: always },
      { label: "Attendance Policy", href: "/attendance-policy", icon: Calendar, show: always },
      { label: "Workshift Roster", href: "/roster", icon: CalendarCheck2, show: always },
      { label: "Regularisation", href: "/attendance-regularisation", icon: CalendarCheck2, show: always },
    ],
  },
  {
    label: "Leave Policy",
    show: (c) => c.canAccessFullHrSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Manage Holidays", href: "/manage-holidays", icon: Calendar, show: always },
      { label: "Public Holiday", href: "/public-holiday", icon: Calendar, show: always },
      { label: "Leave Policy", href: "/leave-policy", icon: Calendar, show: always },
    ],
  },
  {
    label: "Payroll Policy",
    show: (c) => c.canAccessFullHrSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Salary Cycle", href: "/monthly-salary-cycle", icon: Wallet, show: always },
      { label: "Allowances", href: "/salary-allowances", icon: Wallet, show: always },
      { label: "Deductions", href: "/salary-deductions", icon: Wallet, show: always },
      { label: "Paygrade", href: "/monthly-pay-grade", icon: Wallet, show: always },
      { label: "Bonus Rule", href: "/bonus-setup", icon: Wallet, show: always },
    ],
  },
  {
    label: "Payroll",
    show: (c) => c.canAccessFullHrSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Bonus Allocations", href: "/bonus-allocations", icon: Wallet, show: always },
      { label: "Salary Advances", href: "/salary-advance", icon: Wallet, show: always },
      { label: "Reimbursements", href: "/reimbursement", icon: Wallet, show: always },
      { label: "Run Payroll", href: "/generate-salary", icon: Wallet, show: always },
      { label: "Contractor Payouts", href: "/contractor-payout", icon: Wallet, show: always },
    ],
  },
  {
    label: "Leave Management",
    show: (c) => c.canAccessFullHrSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Leave Applications", href: "/leave-applications", icon: Calendar, show: always },
      { label: "Privileged Leave", href: "/privileged-leave", icon: Calendar, show: always },
    ],
  },
  {
    label: "Messaging",
    show: (c) => c.canSeeCompanySetupSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Internal Messaging", href: "/employee-memo", icon: MessageSquare, show: always },
    ],
  },
  {
    label: "Reports",
    show: (c) => c.canSeeCompanySetupSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Attendance Reports", href: "/attendance-reports", icon: FileClock, show: always },
    ],
  },
  {
    label: "Settings",
    show: (c) => c.canSeeCompanySetupSections && !isCompanyAdminLikeRole(c.role),
    items: [
      { label: "Import Attendance", href: "/import-attendance", icon: Settings2, show: (c) => !c.isAdmin },
      { label: "HRMS Integrations", href: "/hrms-integrations", icon: Settings2, show: (c) => c.isAdmin },
      { label: "General", href: "/system-settings/general", icon: Settings2, show: (c) => c.isCompanyAdmin || c.isDesktopManager },
      { label: "Compliance", href: "/system-settings/compliance", icon: Settings2, show: (c) => c.isCompanyAdmin || c.isDesktopManager },
      { label: "Email Templates", href: "/system-settings/email-templates", icon: Settings2, show: (c) => c.isCompanyAdmin || c.isDesktopManager },
    ],
  },
  {
    label: "Administration",
    show: (c) => c.isSuperAdmin || c.isServiceProvider,
    items: [
      { label: "System Users", href: "/system-users", icon: Users, show: always },
      {
        label: "Application Modules",
        href: "/company-modules",
        icon: Database,
        show: (c) => c.isSuperAdmin || c.isServiceProvider,
      },
      {
        label: "Subscriptions",
        href: "/subscription",
        icon: CreditCard,
        show: (c) => c.isSuperAdmin || c.isServiceProvider,
      },
      {
        label: "Approval Workflows",
        href: "/approval-workflows",
        icon: ClipboardList,
        show: () => false,
      },
    ],
  },
  {
    label: "Company Policy Management",
    show: (c) => c.isSuperAdmin,
    items: [
      {
        label: "Terms of Use",
        href: "/policy-management/terms-of-use",
        icon: FileText,
        show: always,
      },
      {
        label: "Privacy Policy",
        href: "/policy-management/privacy-policy",
        icon: FileText,
        show: always,
      },
      {
        label: "SLA",
        href: "/policy-management/sla",
        icon: FileText,
        show: always,
      },
    ],
  },
  {
    label: "Personal",
    show: (c) => c.isServiceProvider || c.isCompanyAdmin || c.isAdmin || c.isBranchAdmin || c.isDesktopManager,
    items: [
      { label: "Profile", href: "/profile", icon: UserCog, show: always },
    ],
  },
];

export function dispatchSidebarMainPageClick(path: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("sidebar-main-page-click", {
      detail: { path },
    })
  );
}

export function filterNavigation(ctx: NavContext): NavGroup[] {
  const gateEmployeeModules = ctx.role === "EMPLOYEE" && hasCompanyAccessFlag();

  return HRMS_NAVIGATION.map((group) => {
    if (group.show && !group.show(ctx)) return null;

    const items = group.items.filter((item) => {
      if (item.show && !item.show(ctx)) return false;
      if (!isProductHrefAllowed(item.href)) return false;
      if (gateEmployeeModules) {
        const moduleKey = moduleKeyForPath(item.href);
        if (moduleKey && !canViewModule(moduleKey)) return false;
      }
      return true;
    });

    if (items.length === 0) return null;

    return { ...group, items };
  }).filter(Boolean) as NavGroup[];
}