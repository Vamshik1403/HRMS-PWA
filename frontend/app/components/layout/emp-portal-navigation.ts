export type EmpSidebarSection =
  | "home"
  | "onboarding"
  | "attendance"
  | "payroll"
  | "reports"
  | "more";

export type EmpPortalZone = "workspace" | "team" | "company";

export type EmpNavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  outlineIcon?: string;
};

export const EMP_SIDEBAR_ITEMS: EmpNavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/empdashboard",
    icon: "solar:home-2-bold-duotone",
    outlineIcon: "solar:home-2-linear",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    href: "/empOnboarding",
    icon: "solar:user-plus-bold-duotone",
    outlineIcon: "solar:user-plus-linear",
  },
  {
    id: "attendance",
    label: "Attendance",
    href: "/empAttendance",
    icon: "solar:map-point-bold-duotone",
    outlineIcon: "solar:map-point-linear",
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/empPayout",
    icon: "solar:bill-bold-duotone",
    outlineIcon: "solar:bill-linear",
  },
  {
    id: "reports",
    label: "Reports",
    href: "/empHistory",
    icon: "solar:chart-2-bold-duotone",
    outlineIcon: "solar:chart-2-linear",
  },
];

export const EMP_MORE_ITEMS: EmpNavItem[] = [
  {
    id: "leave",
    label: "Leave",
    href: "/empLeaveApplication",
    icon: "solar:calendar-bold-duotone",
    outlineIcon: "solar:calendar-linear",
  },
  {
    id: "reimbursement",
    label: "Reimbursement",
    href: "/empReimbursement",
    icon: "solar:wallet-bold-duotone",
    outlineIcon: "solar:wallet-linear",
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/empMyTasks",
    icon: "solar:checklist-bold-duotone",
    outlineIcon: "solar:checklist-linear",
  },
  {
    id: "holidays",
    label: "Holidays",
    href: "/empHolidays",
    icon: "solar:calendar-mark-bold-duotone",
    outlineIcon: "solar:calendar-mark-linear",
  },
  {
    id: "noticeboard",
    label: "Internal Messages",
    href: "/empNoticeboard",
    icon: "solar:bell-bold-duotone",
    outlineIcon: "solar:bell-linear",
  },
  {
    id: "salary-advance",
    label: "Salary Advance",
    href: "/empSalaryAdvance",
    icon: "solar:hand-money-bold-duotone",
    outlineIcon: "solar:hand-money-linear",
  },
  {
    id: "public-holiday",
    label: "Public Holiday",
    href: "/empPublicHoliday",
    icon: "solar:calendar-date-bold-duotone",
    outlineIcon: "solar:calendar-date-linear",
  },
  {
    id: "generate-salary",
    label: "Generate Salary",
    href: "/empGenerateSalary",
    icon: "solar:calculator-bold-duotone",
    outlineIcon: "solar:calculator-linear",
  },
  {
    id: "profile",
    label: "Profile",
    href: "/empProfile",
    icon: "solar:user-circle-bold-duotone",
    outlineIcon: "solar:user-circle-linear",
  },
];

export const EMP_ZONE_ITEMS: { id: EmpPortalZone; label: string }[] = [
  { id: "workspace", label: "My Workspace" },
  { id: "team", label: "Team Management" },
  { id: "company", label: "My Company" },
];

export const EMP_WORKSPACE_SECTIONS = [
  { id: "overview", label: "Overview", href: "/empdashboard" },
  { id: "dashboard", label: "Dashboard", href: "/empdashboard?view=dashboard" },
];

export const EMP_WORKSPACE_TABS = [
  { id: "my-profile", label: "My Profile", href: "/empdashboard", match: (p: string, q: URLSearchParams) => p === "/empdashboard" && !q.get("view") && !q.get("tab") },
  { id: "profile", label: "Profile", href: "/empProfile", match: (p: string) => p === "/empProfile" || p.startsWith("/empProfile/") },
  { id: "approvals", label: "Approvals", href: "/empdashboard?tab=approvals", match: (_p: string, q: URLSearchParams) => q.get("tab") === "approvals" },
  { id: "leave", label: "Leave", href: "/empLeaveApplication", match: (p: string) => p === "/empLeaveApplication" || p.startsWith("/empLeaveApplication/") },
  { id: "attendance", label: "Attendance", href: "/empAttendance", match: (p: string) => p === "/empAttendance" || p.startsWith("/empAttendance/") },
  { id: "promotions", label: "Promotions & Transfer", href: "/empdashboard?tab=promotions", match: (_p: string, q: URLSearchParams) => q.get("tab") === "promotions" },
];

export const EMP_TEAM_TABS = [
  { id: "overview", label: "Overview", href: "/empTeam", match: (p: string) => p === "/empTeam" || p === "/empTeam/" },
  {
    id: "my-team",
    label: "My Team",
    href: "/empTeam/my-team",
    match: (p: string) => p.startsWith("/empTeam/my-team") || p.startsWith("/empTeam/member"),
  },
  { id: "approvals", label: "Approvals", href: "/empTeam/approvals", match: (p: string) => p.startsWith("/empTeam/approvals") },
  { id: "promotions", label: "Promotions & Transfers", href: "/empTeam/promotions", match: (p: string) => p.startsWith("/empTeam/promotions") },
];

export const EMP_COMPANY_TABS = [
  { id: "overview", label: "Overview", href: "/empCompany", match: (p: string) => p === "/empCompany" },
  { id: "holidays", label: "Holidays", href: "/empHolidays", match: (p: string) => p === "/empHolidays" },
  { id: "noticeboard", label: "Noticeboard", href: "/empNoticeboard", match: (p: string) => p === "/empNoticeboard" || p.startsWith("/empNoticeboard/") },
  { id: "public-holiday", label: "Public Holidays", href: "/empPublicHoliday", match: (p: string) => p === "/empPublicHoliday" },
];

const HOME_PATH_PREFIXES = [
  "/empdashboard",
  "/empProfile",
  "/empTeam",
  "/empCompany",
  "/empLeaveApplication",
  "/empAttendance",
];

const MORE_PATH_PREFIXES = EMP_MORE_ITEMS.map((i) => i.href);

export function resolveSidebarSection(pathname: string): EmpSidebarSection {
  if (pathname.startsWith("/empOnboarding")) return "onboarding";
  if (pathname.startsWith("/empAttendance")) return "attendance";
  if (
    pathname.startsWith("/empPayout") ||
    pathname.startsWith("/empGenerateSalary") ||
    pathname.startsWith("/empSalaryAdvance")
  ) {
    return "payroll";
  }
  if (pathname.startsWith("/empHistory")) return "reports";
  if (MORE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return "more";
  }
  if (HOME_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return "home";
  }
  return "home";
}

export function resolvePortalZone(pathname: string): EmpPortalZone {
  if (pathname.startsWith("/empTeam")) return "team";
  if (pathname.startsWith("/empCompany") || pathname.startsWith("/empHolidays") || pathname.startsWith("/empNoticeboard") || pathname.startsWith("/empPublicHoliday")) {
    return "company";
  }
  return "workspace";
}

export function isHomeSectionActive(pathname: string): boolean {
  return resolveSidebarSection(pathname) === "home";
}

export function pathnameMatches(href: string, pathname: string, search = ""): boolean {
  const [path, query] = href.split("?");
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  if (!query) return pathname === path || (path !== "/empdashboard" && pathname.startsWith(`${path}/`));
  const expected = new URLSearchParams(query);
  const actual = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}
