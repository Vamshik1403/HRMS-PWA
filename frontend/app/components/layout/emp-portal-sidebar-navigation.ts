"use client";

import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  Home,
  ListTodo,
  MapPin,
  MessageSquare,
  ArrowLeftRight,
  UserCircle,
  Users,
  RotateCcw,
  CalendarClock,
  UserMinus,
  Wallet,
  Coins,
  Gift,
  Briefcase,
  BadgeDollarSign,
  Truck,
  BarChart3,
  CalendarRange,
  Receipt,
  ScrollText,
  ClipboardList,
  History,
  DollarSign,
  Fingerprint,
  type LucideIcon,
} from "lucide-react";
import type { EmpModuleId } from "./emp-portal-workspaces";
import { EMP_SETUP_TABS_REGISTRY } from "./emp-setup-tabs-registry";
import { canViewModule, hasCompanyAccessFlag, isCompanyOwnerFlag } from "@/lib/companyAccess";
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";

/** Paths that belong under a setup hub (Company / Policy / Payroll / Statutory). */
function isSetupHubChildPath(hubHref: string, pathname: string): boolean {
  const tabs = EMP_SETUP_TABS_REGISTRY[hubHref];
  if (!tabs) return false;
  return tabs.some((tab) =>
    tab.items.some(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ),
  );
}

export interface EmpSidebarNavItem {
  /** Stable section key for sidebar back-history (must be unique). */
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  moduleId?: EmpModuleId | "more" | "team" | "company" | "company-dashboard" | "tasks" | "customers" | "promotions";
  tabMatch?: string | null;
  managerOnly?: boolean;
  companyAccessOnly?: boolean;
  show?: () => boolean;
}

export interface EmpSidebarNavGroup {
  label: string;
  managerOnly?: boolean;
  /** Optional group-level visibility gate (e.g. requires any company access). */
  show?: () => boolean;
  items: EmpSidebarNavItem[];
}

const always = () => true;

function canAccessTasksModule(): boolean {
  return TASK_MANAGEMENT_ENABLED && canViewModule("TASKS");
}

function canAccessMyTasksOnly(): boolean {
  return TASK_MANAGEMENT_ENABLED && !canViewModule("TASKS");
}

/** Any admin/company-scoped group is only relevant once the login has some company access. */
function hasAnyCompanyAccess(): boolean {
  return hasCompanyAccessFlag();
}

function canModule(moduleKey: string): () => boolean {
  return () => canViewModule(moduleKey);
}

function canRights(): boolean {
  return isCompanyOwnerFlag() || canViewModule("RIGHTS");
}

export const EMP_SIDEBAR_NAVIGATION: EmpSidebarNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        id: "home",
        label: "Home",
        href: "/empdashboard",
        icon: Home,
        moduleId: "home",
        tabMatch: "dashboard",
      },
    ],
  },
  {
    label: "My Workspace",
    items: [
      {
        id: "profile",
        label: "My Profile",
        href: "/empProfile",
        icon: UserCircle,
        moduleId: "profile",
        tabMatch: "profile",
      },
      {
        id: "calendar",
        label: "My Calendar",
        href: "/empdashboard?tab=calendar",
        icon: CalendarDays,
        moduleId: "home",
        tabMatch: "calendar",
      },
      {
        id: "my-tasks",
        label: "My Tasks",
        href: "/empMyTasks",
        icon: ListTodo,
        moduleId: "tasks",
        show: () => canAccessMyTasksOnly(),
      },
      {
        id: "tasks",
        label: "Tasks",
        href: "/task-projects",
        icon: ListTodo,
        moduleId: "tasks",
        show: () => canAccessTasksModule() && !hasAnyCompanyAccess(),
      },
      {
        id: "im",
        label: "IM",
        href: "/empProfile?tab=messaging",
        icon: MessageSquare,
        moduleId: "profile",
        tabMatch: "messaging",
      },
    ],
  },
  {
    label: "Team Management",
    managerOnly: true,
    items: [
      {
        id: "team",
        label: "My Team",
        href: "/empTeam/my-team",
        icon: Users,
        moduleId: "team",
      },
      {
        id: "team-approvals",
        label: "Team Approvals",
        href: "/empTeam/approvals",
        icon: ClipboardCheck,
        moduleId: "team",
      },
      {
        id: "promotions",
        label: "Promotions & Transfers",
        href: "/empTeam/promotions",
        icon: ArrowLeftRight,
        moduleId: "promotions",
        managerOnly: true,
      },
    ],
  },
  {
    label: "Customer Management",
    show: () => !hasAnyCompanyAccess(),
    items: [
      {
        id: "customers",
        label: "Customers",
        href: "/task-customers",
        icon: Users,
        moduleId: "customers",
        show: () => canAccessTasksModule(),
      },
      {
        id: "sites",
        label: "Sites / Branches",
        href: "/task-customer-sites",
        icon: MapPin,
        moduleId: "customers",
        show: () => canAccessTasksModule(),
      },
    ],
  },
  {
    label: "Employee Management",
    show: () => false,
    items: [
      {
        id: "admin-employees",
        label: "Employees",
        href: "/manage-employees",
        icon: Users,
        show: canModule("EMPLOYEES"),
      },
      {
        id: "admin-regularisation",
        label: "Regularisation",
        href: "/attendance-regularisation",
        icon: RotateCcw,
        show: canModule("REGULARISATION"),
      },
      {
        id: "admin-roster",
        label: "Workshift Roster",
        href: "/roster",
        icon: CalendarClock,
        show: canModule("ROSTER"),
      },
      {
        id: "admin-offboarding",
        label: "Offboarding",
        href: "/termination",
        icon: UserMinus,
        show: canModule("OFFBOARDING"),
      },
    ],
  },
  {
    label: "Payroll Management",
    show: () => false,
    items: [
      {
        id: "admin-run-payroll",
        label: "Payroll",
        href: "/generate-salary",
        icon: Wallet,
        show: canModule("PAYROLL"),
      },
      {
        id: "admin-salary-advance",
        label: "Salary Advances",
        href: "/salary-advance",
        icon: Coins,
        show: canModule("SALARY_ADVANCES"),
      },
      {
        id: "admin-reimbursement",
        label: "Reimbursements",
        href: "/reimbursement",
        icon: BadgeDollarSign,
        show: canModule("REIMBURSEMENTS"),
      },
      {
        id: "admin-bonus-allocations",
        label: "Bonus Allocations",
        href: "/bonus-allocations",
        icon: Gift,
        show: canModule("PAYROLL"),
      },
    ],
  },
  {
    label: "Contract Management",
    show: () => false,
    items: [
      {
        id: "admin-contract-employee",
        label: "Contract Employee",
        href: "/contract-employee",
        icon: Briefcase,
        show: canModule("CONTRACTORS"),
      },
      {
        id: "admin-contractors",
        label: "Contractors",
        href: "/contractors",
        icon: Truck,
        show: canModule("CONTRACTORS"),
      },
      {
        id: "admin-contractor-rates",
        label: "Contractor Rates",
        href: "/contractor-rates",
        icon: DollarSign,
        show: canModule("CONTRACTOR_RATES"),
      },
      {
        id: "admin-contractor-payout",
        label: "Contractor Payout",
        href: "/contractor-payout",
        icon: BadgeDollarSign,
        show: canModule("CONTRACTORS"),
      },
    ],
  },
  {
    label: "Reports",
    show: () => false,
    items: [
      {
        id: "admin-attendance-reports",
        label: "Attendance Reports",
        href: "/attendance-reports",
        icon: BarChart3,
        show: canModule("REPORTS"),
      },
      {
        id: "admin-leave-reports",
        label: "Leave Reports",
        href: "/leave-reports",
        icon: CalendarRange,
        show: canModule("REPORTS"),
      },
      {
        id: "admin-payroll-reports",
        label: "Payroll Reports",
        href: "/payroll-reports",
        icon: Receipt,
        show: canModule("REPORTS"),
      },
      {
        id: "admin-statutory-reports",
        label: "Statutory Reports & Challans",
        href: "/statutory-reports",
        icon: ScrollText,
        show: canModule("REPORTS"),
      },
      {
        id: "admin-contractor-reports",
        label: "Contractors Reports",
        href: "/contractor-reports",
        icon: ClipboardList,
        show: canModule("REPORTS"),
      },
    ],
  },
  {
    label: "My Company",
    show: hasAnyCompanyAccess,
    items: [
      {
        id: "company",
        label: "My Company",
        href: "/my-company",
        icon: Building2,
        moduleId: "company",
        companyAccessOnly: true,
      },
      {
        id: "company-branches",
        label: "Branches",
        href: "/my-company/company?tab=branches",
        icon: MapPin,
        companyAccessOnly: true,
        show: canModule("BRANCHES"),
      },
      {
        id: "company-devices",
        label: "Attendance Devices",
        href: "/my-company/company?tab=devices",
        icon: Fingerprint,
        companyAccessOnly: true,
        show: canModule("DEVICES"),
      },
    ],
  },
  {
    label: "Administration",
    show: hasAnyCompanyAccess,
    items: [
      {
        id: "admin-system-logs",
        label: "System Logs",
        href: "/audit-logs",
        icon: History,
        show: () => isCompanyOwnerFlag() || canViewModule("SETTINGS"),
      },
    ],
  },
];

const COMPANY_PATH_PREFIXES = [
  "/my-company",
  "/empCompanyDashboard",
  "/empCompany",
  "/empHolidays",
  "/empNoticeboard",
  "/empPublicHoliday",
  "/company-hierarchy",
];

function isCompanyPath(pathname: string): boolean {
  // Drill-down pages from My Company KPIs are standalone views, not My Company itself.
  if (
    pathname === "/attendance-logs" ||
    pathname.startsWith("/attendance-logs/") ||
    pathname === "/new-joiners" ||
    pathname.startsWith("/new-joiners/")
  ) {
    return false;
  }
  return COMPANY_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function filterEmpSidebarNavigation(isManager: boolean): EmpSidebarNavGroup[] {
  const hasAccess = hasCompanyAccessFlag();
  return EMP_SIDEBAR_NAVIGATION.map((group) => {
    if (group.managerOnly && !isManager) return { ...group, items: [] };
    if (group.show && !group.show()) return { ...group, items: [] };
    return {
      ...group,
      items: group.items.filter((item) => {
        if (item.companyAccessOnly && !hasAccess) return false;
        if (item.managerOnly && !isManager) return false;
        return (item.show ?? always)();
      }),
    };
  }).filter((group) => group.items.length > 0);
}

export function isEmpNavItemActive(
  item: EmpSidebarNavItem,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  const tab = searchParams.get("tab");

  if (item.id === "company-branches") {
    return (
      (pathname === "/my-company/company" && tab === "branches") ||
      pathname === "/branches" ||
      pathname.startsWith("/branches/")
    );
  }
  if (item.id === "company-devices") {
    return (
      (pathname === "/my-company/company" && tab === "devices") ||
      pathname === "/devices" ||
      pathname.startsWith("/devices/")
    );
  }

  // Keep My Company highlighted across the tile hub and legacy company paths.
  if (
    item.moduleId === "company" ||
    item.href === "/my-company" ||
    item.href === "/empCompany" ||
    item.href === "/empCompanyDashboard"
  ) {
    if (
      pathname === "/my-company/company" &&
      (tab === "branches" || tab === "devices")
    ) {
      return false;
    }
    return isCompanyPath(pathname);
  }

  if (item.tabMatch === "dashboard") {
    return (
      pathname === "/empdashboard" &&
      (!tab || tab === "dashboard" || tab === "overview")
    );
  }
  if (item.tabMatch === "calendar") {
    return pathname === "/empdashboard" && tab === "calendar";
  }
  if (item.tabMatch === "profile") {
    return pathname === "/empProfile" && tab !== "messaging";
  }
  if (item.tabMatch === "messaging") {
    return pathname === "/empProfile" && tab === "messaging";
  }

  if (item.href === "/empMyTasks" || item.id === "my-tasks") {
    return pathname === "/empMyTasks" || pathname.startsWith("/empMyTasks/");
  }

  if (item.href === "/task-projects" || item.id === "tasks") {
    return pathname === "/task-projects" || pathname.startsWith("/task-projects/");
  }

  if (item.moduleId === "tasks") {
    return (
      pathname === "/task-projects" ||
      pathname.startsWith("/task-projects/") ||
      pathname === "/empMyTasks" ||
      pathname.startsWith("/empMyTasks/")
    );
  }

  if (item.moduleId === "customers") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  if (item.moduleId === "promotions" || item.href === "/empTeam/promotions") {
    return (
      pathname === "/empTeam/promotions" ||
      pathname.startsWith("/empTeam/promotions/") ||
      pathname === "/employees-promotions" ||
      pathname.startsWith("/employees-promotions/")
    );
  }

  if (item.moduleId === "team") {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return true;
    }
    if (item.href === "/empTeam/my-team") {
      return pathname.startsWith("/empTeam/member");
    }
    // Team Approvals → Regularization stays under emp portal (not admin shell).
    if (
      item.id === "team-approvals" &&
      (pathname === "/empTeam/regularisation" ||
        pathname.startsWith("/empTeam/regularisation/"))
    ) {
      return true;
    }
    return false;
  }

  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    if (item.href === "/empMore") {
      return pathname === "/empMore" || pathname.startsWith("/empMore/");
    }
    return true;
  }

  // Keep setup hub items active on their nested tab pages (Branches, Designations, …).
  if (
    item.href === "/company-setup" ||
    item.href === "/policy-setup" ||
    item.href === "/payroll-setup" ||
    item.href === "/statutory-reports"
  ) {
    if (isSetupHubChildPath(item.href, pathname)) return true;
  }

  // Remaining admin pages not yet promoted to their own sidebar item — keep More highlighted.
  if (item.href === "/empMore" && hasCompanyAccessFlag()) {
    const adminPrefixes = ["/attendance-logs", "/new-joiners"];
    if (adminPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return true;
    }
  }

  return false;
}
