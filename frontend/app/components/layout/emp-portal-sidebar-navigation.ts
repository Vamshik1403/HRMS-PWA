"use client";

import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  Home,
  LayoutGrid,
  MessageSquare,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { EmpModuleId } from "./emp-portal-workspaces";

export interface EmpSidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  moduleId?: EmpModuleId | "more" | "team" | "company";
  tabMatch?: string | null;
  managerOnly?: boolean;
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
        href: "/empCompany",
        icon: Building2,
        moduleId: "company",
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
  return EMP_SIDEBAR_NAVIGATION.map((group) => {
    if (group.managerOnly && !isManager) return { ...group, items: [] };
    return {
      ...group,
      items: group.items.filter((item) => {
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

  if (item.moduleId === "company" || item.href === "/empCompany") {
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

  return false;
}
