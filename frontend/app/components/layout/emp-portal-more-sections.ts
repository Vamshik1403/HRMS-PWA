import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";

export type EmpMoreSection = {
  id: string;
  label: string;
  href: string;
  icon: string;
  iconClassName: string;
  managerOnly?: boolean;
  show?: () => boolean;
};

const always = () => true;

export const EMP_MORE_SECTIONS: EmpMoreSection[] = [
  {
    id: "home",
    label: "Home",
    href: "/empdashboard",
    icon: "solar:home-2-bold-duotone",
    iconClassName: "text-[#4f46e5]",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    href: "/empOnboarding",
    icon: "solar:user-plus-bold-duotone",
    iconClassName: "text-amber-500",
  },
  {
    id: "attendance",
    label: "Attendance",
    href: "/empAttendance",
    icon: "solar:map-point-bold-duotone",
    iconClassName: "text-orange-500",
  },
  {
    id: "leave",
    label: "Leave",
    href: "/empLeaveApplication",
    icon: "solar:calendar-bold-duotone",
    iconClassName: "text-sky-500",
  },
  {
    id: "calendar",
    label: "My Calendar",
    href: "/empdashboard?tab=calendar",
    icon: "solar:calendar-date-bold-duotone",
    iconClassName: "text-violet-500",
  },
  {
    id: "profile",
    label: "My Profile",
    href: "/empProfile",
    icon: "solar:user-circle-bold-duotone",
    iconClassName: "text-indigo-500",
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/empPayout",
    icon: "solar:bill-bold-duotone",
    iconClassName: "text-emerald-500",
  },
  {
    id: "reimbursement",
    label: "Reimbursement",
    href: "/empReimbursement",
    icon: "solar:wallet-bold-duotone",
    iconClassName: "text-teal-500",
  },
  {
    id: "reports",
    label: "Reports",
    href: "/empHistory",
    icon: "solar:chart-2-bold-duotone",
    iconClassName: "text-blue-500",
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/empMyTasks",
    icon: "solar:checklist-bold-duotone",
    iconClassName: "text-rose-500",
    show: () => TASK_MANAGEMENT_ENABLED,
  },
  {
    id: "holidays",
    label: "Holidays",
    href: "/empHolidays",
    icon: "solar:calendar-mark-bold-duotone",
    iconClassName: "text-pink-500",
  },
  {
    id: "noticeboard",
    label: "Internal Messages",
    href: "/empNoticeboard",
    icon: "solar:bell-bold-duotone",
    iconClassName: "text-fuchsia-500",
  },
  {
    id: "public-holiday",
    label: "Public Holiday",
    href: "/empPublicHoliday",
    icon: "solar:calendar-search-bold-duotone",
    iconClassName: "text-cyan-500",
  },
  {
    id: "salary-advance",
    label: "Salary Advance",
    href: "/empSalaryAdvance",
    icon: "solar:hand-money-bold-duotone",
    iconClassName: "text-lime-600",
  },
  {
    id: "generate-salary",
    label: "Generate Salary",
    href: "/empGenerateSalary",
    icon: "solar:calculator-bold-duotone",
    iconClassName: "text-yellow-600",
  },
  {
    id: "promotions",
    label: "Promotions and Transfers",
    href: "/empTeam/promotions",
    icon: "solar:transfer-horizontal-bold-duotone",
    iconClassName: "text-indigo-600",
    managerOnly: true,
  },
  {
    id: "my-team",
    label: "My Team",
    href: "/empTeam/my-team",
    icon: "solar:users-group-two-rounded-bold-duotone",
    iconClassName: "text-violet-500",
    managerOnly: true,
  },
  {
    id: "team-approvals",
    label: "Team Approvals",
    href: "/empTeam/approvals",
    icon: "solar:clipboard-check-bold-duotone",
    iconClassName: "text-emerald-600",
    managerOnly: true,
  },
  {
    id: "company-overview",
    label: "My Company",
    href: "/empCompany",
    icon: "solar:buildings-2-bold-duotone",
    iconClassName: "text-slate-600",
    managerOnly: true,
  },
  {
    id: "departments",
    label: "Departments",
    href: "/empCompany/departments",
    icon: "solar:branching-paths-down-bold-duotone",
    iconClassName: "text-blue-600",
    managerOnly: true,
  },
];

export function getVisibleEmpMoreSections(isManager: boolean): EmpMoreSection[] {
  return EMP_MORE_SECTIONS.filter((section) => {
    if (section.managerOnly && !isManager) return false;
    return (section.show ?? always)();
  });
}
