"use client";

import {
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  FileText,
  Home,
  MapPin,
  UserCircle,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";
import type { EmpModuleId } from "./emp-portal-workspaces";

export interface EmpSidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  moduleId?: EmpModuleId | "more";
  tabMatch?: string | null;
  show?: () => boolean;
}

export interface EmpSidebarNavGroup {
  label: string;
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
        tabMatch: null,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        label: "Onboarding",
        href: "/empOnboarding",
        icon: UserPlus,
        moduleId: "onboarding",
      },
      {
        label: "Attendance",
        href: "/empAttendance",
        icon: MapPin,
        moduleId: "attendance",
      },
      {
        label: "Leave",
        href: "/empLeaveApplication",
        icon: Calendar,
        moduleId: "leave",
      },
      {
        label: "My Calendar",
        href: "/empdashboard?tab=calendar",
        icon: CalendarDays,
        moduleId: "home",
        tabMatch: "calendar",
      },
      {
        label: "My Profile",
        href: "/empProfile",
        icon: UserCircle,
        moduleId: "profile",
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      {
        label: "Payroll",
        href: "/empPayout",
        icon: FileText,
        moduleId: "payroll",
      },
      {
        label: "Reimbursement",
        href: "/empReimbursement",
        icon: Wallet,
        moduleId: "reimbursement",
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "Reports",
        href: "/empHistory",
        icon: BarChart3,
        moduleId: "reports",
      },
    ],
  },
  {
    label: "More",
    items: [
      {
        label: "Tasks",
        href: "/empMyTasks",
        icon: CheckSquare,
        moduleId: "tasks",
        show: () => TASK_MANAGEMENT_ENABLED,
      },
      {
        label: "Holidays",
        href: "/empHolidays",
        icon: CalendarDays,
        moduleId: "leave",
      },
      {
        label: "Internal Messages",
        href: "/empNoticeboard",
        icon: Bell,
        moduleId: "home",
      },
      {
        label: "Public Holiday",
        href: "/empPublicHoliday",
        icon: CalendarRange,
        moduleId: "home",
      },
    ],
  },
];

export function filterEmpSidebarNavigation(): EmpSidebarNavGroup[] {
  return EMP_SIDEBAR_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => (item.show ?? always)()),
  })).filter((group) => group.items.length > 0);
}

export function isEmpNavItemActive(
  item: EmpSidebarNavItem,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  const tab = searchParams.get("tab");

  if (item.tabMatch === "dashboard") {
    return pathname.startsWith("/empdashboard") && (!tab || tab === "dashboard" || tab === "overview");
  }
  if (item.tabMatch === "calendar") {
    return pathname.startsWith("/empdashboard") && tab === "calendar";
  }

  if (item.tabMatch === null) {
    const onHome =
      pathname === "/empdashboard" ||
      pathname.startsWith("/empTeam") ||
      pathname.startsWith("/empCompany");
    if (!onHome) return false;
    return !tab || tab === "dashboard" || tab === "overview";
  }

  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    if (item.href === "/empdashboard") {
      return !tab || tab === "dashboard" || tab === "overview";
    }
    return true;
  }

  if (item.href === "/empdashboard") {
    return (
      (pathname.startsWith("/empTeam") || pathname.startsWith("/empCompany")) &&
      (!tab || tab === "dashboard" || tab === "overview")
    );
  }

  return false;
}
