"use client";

import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  Home,
  LayoutGrid,
  ListTodo,
  MessageSquare,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { EmpModuleId } from "./emp-portal-workspaces";
import { hasCompanyAccessFlag } from "@/lib/companyAccess";
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";

export interface EmpSidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  moduleId?: EmpModuleId | "more" | "team" | "company" | "company-dashboard" | "tasks";
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

export const EMP_SIDEBAR_NAVIGATION: EmpSidebarNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
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
        label: "My Profile",
        href: "/empProfile",
        icon: UserCircle,
        moduleId: "profile",
        tabMatch: "profile",
      },
      {
        label: "My Calendar",
        href: "/empdashboard?tab=calendar",
        icon: CalendarDays,
        moduleId: "home",
        tabMatch: "calendar",
      },
      {
        label: "My Tasks",
        href: "/empMyTasks",
        icon: ListTodo,
        moduleId: "tasks",
        show: () => TASK_MANAGEMENT_ENABLED,
      },
      {
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
        label: "My Team",
        href: "/empTeam/my-team",
        icon: Users,
        moduleId: "team",
      },
      {
        label: "Team Approvals",
        href: "/empTeam/approvals",
        icon: ClipboardCheck,
        moduleId: "team",
      },
    ],
  },
  {
    label: "My Company",
    managerOnly: true,
    items: [
      {
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

  if (item.href === "/empCompanyDashboard") {
    return pathname === "/empCompanyDashboard" || pathname.startsWith("/empCompanyDashboard/");
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

  if (item.href === "/empMyTasks" || item.moduleId === "tasks") {
    return pathname === "/empMyTasks" || pathname.startsWith("/empMyTasks/");
  }

  if (item.moduleId === "company" || item.href === "/empCompany" || item.href === "/empCompanyDashboard") {
    return isCompanyPath(pathname);
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
      "/task-customers",
      "/task-customer-sites",
      "/task-projects",
      "/employee-memo",
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
