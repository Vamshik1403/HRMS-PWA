export type EmpModuleId =
  | "home"
  | "onboarding"
  | "attendance"
  | "leave"
  | "payroll"
  | "reimbursement"
  | "reports"
  | "tasks"
  | "profile";

export type WorkspaceTab = {
  id: string;
  label: string;
  href?: string;
  managerOnly?: boolean;
};

export type ModuleWorkspace = {
  id: EmpModuleId;
  label: string;
  basePath: string;
  tabs: WorkspaceTab[];
  /** @deprecated Zone nav removed — kept for compatibility */
  usesZoneNav?: boolean;
};

export const MODULE_WORKSPACES: ModuleWorkspace[] = [
  {
    id: "home",
    label: "Home",
    basePath: "/empdashboard",
    tabs: [{ id: "dashboard", label: "Dashboard" }],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    basePath: "/empOnboarding",
    tabs: [{ id: "overview", label: "Overview" }],
  },
  {
    id: "attendance",
    label: "Attendance",
    basePath: "/empAttendance",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "check-in", label: "Check In / Out" },
      { id: "history", label: "History" },
      { id: "calendar", label: "Calendar" },
      { id: "reports", label: "Reports" },
    ],
  },
  {
    id: "leave",
    label: "Leave",
    basePath: "/empLeaveApplication",
    // Single tab — avoids duplicate Overview/Apply/History/… bar (already in My Profile)
    tabs: [{ id: "overview", label: "Overview" }],
  },
  {
    id: "payroll",
    label: "Payroll",
    basePath: "/empPayout",
    tabs: [
      { id: "payslips", label: "Payslips" },
      { id: "salary-advance", label: "Salary Advance" },
    ],
  },
  {
    id: "reimbursement",
    label: "Reimbursement",
    basePath: "/empReimbursement",
    // Single tab — avoids duplicate Overview/Apply/History/… bar (already in My Profile)
    tabs: [{ id: "overview", label: "Overview" }],
  },
  {
    id: "reports",
    label: "Reports",
    basePath: "/empHistory",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "attendance", label: "Attendance" },
      { id: "leave", label: "Leave" },
      { id: "payroll", label: "Payroll" },
    ],
  },
  {
    id: "tasks",
    label: "Tasks",
    basePath: "/empMyTasks",
    // Single tab — title lives in the portal navbar (no workspace tab strip)
    tabs: [{ id: "overview", label: "Overview" }],
  },
  {
    id: "profile",
    label: "Profile",
    basePath: "/empProfile",
    tabs: [
      { id: "profile", label: "Profile" },
      { id: "attendance", label: "Attendance" },
      { id: "leave", label: "Leave" },
      { id: "reimbursement", label: "Reimbursement" },
      { id: "delegation", label: "My Delegation" },
    ],
  },
];

const PATH_TO_MODULE: { prefix: string; id: EmpModuleId }[] = [
  { prefix: "/empdashboard", id: "home" },
  { prefix: "/empOnboarding", id: "onboarding" },
  { prefix: "/empAttendance", id: "attendance" },
  { prefix: "/empLeaveApplication", id: "leave" },
  { prefix: "/empPayout", id: "payroll" },
  { prefix: "/empGenerateSalary", id: "payroll" },
  { prefix: "/empSalaryAdvance", id: "payroll" },
  { prefix: "/empReimbursement", id: "reimbursement" },
  { prefix: "/empHistory", id: "reports" },
  { prefix: "/empMyTasks", id: "tasks" },
  { prefix: "/empProfile", id: "profile" },
];

export function resolveModuleWorkspace(pathname: string): ModuleWorkspace | null {
  const match = PATH_TO_MODULE.find(
    (p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`),
  );
  if (!match) return null;
  return MODULE_WORKSPACES.find((w) => w.id === match.id) ?? null;
}

export function resolveModuleTab(
  workspace: ModuleWorkspace,
  searchParams: URLSearchParams,
  pathname: string,
): string {
  const tab = searchParams.get("tab");
  if (tab && workspace.tabs.some((t) => t.id === tab)) return tab;

  // Legacy path-based tab hints
  if (workspace.id === "leave" && pathname.includes("/new")) return "apply";
  if (workspace.id === "reimbursement" && pathname.includes("/new")) return "apply";
  if (workspace.id === "payroll" && pathname.startsWith("/empSalaryAdvance")) return "salary-advance";
  if (workspace.id === "payroll") {
    const tab = searchParams.get("tab");
    if (tab === "salary-advance") return "salary-advance";
    if (tab === "generate") return "payslips";
    if (tab === "overview") return "payslips";
    return tab && workspace.tabs.some((t) => t.id === tab) ? tab : "payslips";
  }
  if (workspace.id === "home") {
    if (searchParams.get("view") === "dashboard") return "dashboard";
    if (searchParams.get("tab") === "approvals") return "approvals";
    if (searchParams.get("tab") === "promotions") return "promotions";
    if (pathname.startsWith("/empProfile")) return "profile";
    if (pathname.startsWith("/empLeaveApplication")) return "leave";
    if (pathname.startsWith("/empAttendance")) return "attendance";
  }
  if (workspace.id === "leave" && pathname.startsWith("/empHolidays")) return "holidays";

  return workspace.tabs[0]?.id ?? "overview";
}

export function moduleTabHref(basePath: string, tabId: string): string {
  if (tabId === "overview") return basePath;
  return `${basePath}?tab=${tabId}`;
}

export function homeWorkspaceTabHref(tab: WorkspaceTab): string {
  if (tab.href) return tab.href;
  return moduleTabHref("/empdashboard", tab.id);
}

export function resolveHomeWorkspaceTab(pathname: string, searchParams: URLSearchParams): string {
  if (pathname === "/empProfile" || pathname.startsWith("/empProfile/")) return "profile";
  const tab = searchParams.get("tab");
  if (tab === "overview") return "dashboard";
  if (tab === "calendar") return "calendar";
  return "dashboard";
}

export const HOME_WORKSPACE = MODULE_WORKSPACES.find((w) => w.id === "home")!;

export function visibleModuleTabs(workspace: ModuleWorkspace, isManager: boolean): WorkspaceTab[] {
  return workspace.tabs.filter((t) => !t.managerOnly || isManager);
}

/** Sidebar items — primary modules as workspaces */
export const EMP_SIDEBAR_WORKSPACES = [
  { id: "home" as const, label: "Home", href: "/empdashboard", icon: "solar:home-2-bold-duotone", outlineIcon: "solar:home-2-linear" },
  { id: "onboarding" as const, label: "Onboarding", href: "/empOnboarding", icon: "solar:user-plus-bold-duotone", outlineIcon: "solar:user-plus-linear" },
  { id: "attendance" as const, label: "Attendance", href: "/empAttendance", icon: "solar:map-point-bold-duotone", outlineIcon: "solar:map-point-linear" },
  { id: "leave" as const, label: "Leave", href: "/empLeaveApplication", icon: "solar:calendar-bold-duotone", outlineIcon: "solar:calendar-linear" },
  { id: "payroll" as const, label: "Payroll", href: "/empPayout", icon: "solar:bill-bold-duotone", outlineIcon: "solar:bill-linear" },
  { id: "reimbursement" as const, label: "Reimbursement", href: "/empReimbursement", icon: "solar:wallet-bold-duotone", outlineIcon: "solar:wallet-linear" },
  { id: "reports" as const, label: "Reports", href: "/empHistory", icon: "solar:chart-2-bold-duotone", outlineIcon: "solar:chart-2-linear" },
];

export const EMP_MORE_WORKSPACE_ITEMS = [
  { id: "tasks", label: "Tasks", href: "/empMyTasks", icon: "solar:checklist-bold-duotone", outlineIcon: "solar:checklist-linear" },
  { id: "holidays", label: "Holidays", href: "/empHolidays", icon: "solar:calendar-mark-bold-duotone", outlineIcon: "solar:calendar-mark-linear" },
  { id: "noticeboard", label: "Internal Messages", href: "/empNoticeboard", icon: "solar:bell-bold-duotone", outlineIcon: "solar:bell-linear" },
  { id: "public-holiday", label: "Public Holiday", href: "/empPublicHoliday", icon: "solar:calendar-date-bold-duotone", outlineIcon: "solar:calendar-date-linear" },
  { id: "profile", label: "Profile", href: "/empProfile", icon: "solar:user-circle-bold-duotone", outlineIcon: "solar:user-circle-linear" },
];

export function resolveSidebarModuleId(pathname: string): EmpModuleId | "more" {
  const ws = resolveModuleWorkspace(pathname);
  if (ws) return ws.id;
  if (EMP_MORE_WORKSPACE_ITEMS.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))) {
    return "more";
  }
  if (pathname === "/empMore" || pathname.startsWith("/empMore/")) {
    return "more";
  }
  return "home";
}
