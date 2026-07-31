"use client";

import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  Home,
  LayoutGrid,
  ListTodo,
  MapPin,
  MessageSquare,
  ArrowLeftRight,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { EmpModuleId } from "./emp-portal-workspaces";
import { canViewModule, hasCompanyAccessFlag } from "@/lib/companyAccess";
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";

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
  items: EmpSidebarNavItem[];
}

const always = () => true;

function canAccessTasksModule(): boolean {
  return TASK_MANAGEMENT_ENABLED && canViewModule("TASKS");
}

function canAccessMyTasksOnly(): boolean {
  return TASK_MANAGEMENT_ENABLED && !canViewModule("TASKS");
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
        show: () => canAccessTasksModule(),
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
    label: "My Company",
    managerOnly: true,
    items: [
      {
        id: "company",
        label: "My Company",
        href: "/empCompanyDashboard",
        icon: Building2,
        moduleId: "company",
        companyAccessOnly: true,
      },
    ],
  },
  {
    label: "More",
    items: [
      {
        id: "more",
        label: "More",
        href: "/empMore",
        icon: LayoutGrid,
        moduleId: "more",
      },
    ],
  },
];

const COMPANY_PATH_PREFIXES = [
  "/empCompanyDashboard",
  "/empCompany",
  "/empHolidays",
  "/empNoticeboard",
  "/empPublicHoliday",
];

function isCompanyPath(pathname: string): boolean {
  return COMPANY_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function filterEmpSidebarNavigation(isManager: boolean): EmpSidebarNavGroup[] {
  const hasAccess = hasCompanyAccessFlag();
  return EMP_SIDEBAR_NAVIGATION.map((group) => {
    if (group.managerOnly && !isManager) return { ...group, items: [] };
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

  // Keep My Company highlighted across Dashboard / Departments / Holidays.
  if (
    item.moduleId === "company" ||
    item.href === "/empCompany" ||
    item.href === "/empCompanyDashboard"
  ) {
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
    return false;
  }

  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    if (item.href === "/empMore") {
      return pathname === "/empMore" || pathname.startsWith("/empMore/");
    }
    return true;
  }

  // Admin CRUD pages opened from More — keep More highlighted for company operators.
  if (item.href === "/empMore" && hasCompanyAccessFlag()) {
    const adminPrefixes = [
      "/manage-employees",
      "/termination",
      "/branches",
      "/departments",
      "/designations",
      "/devices",
      "/contractors",
      "/contractor-rates",
      "/contractor-payout",
      "/work-shifts",
      "/attendance-policy",
      "/roster",
      "/attendance-regularisation",
      "/manage-holidays",
      "/public-holiday",
      "/leave-policy",
      "/leave-applications",
      "/privileged-leave",
      "/monthly-salary-cycle",
      "/salary-allowances",
      "/salary-deductions",
      "/monthly-pay-grade",
      "/bonus-setup",
      "/bonus-allocations",
      "/generate-salary",
      "/reimbursement",
      "/salary-advance",
      "/attendance-reports",
      "/attendance-logs",
      "/import-attendance",
      "/system-settings",
      "/new-joiners",
      "/empRights",
    ];
    if (adminPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return true;
    }
  }

  return false;
}
