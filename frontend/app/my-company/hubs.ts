export type CompanyHubId =
  | "company"
  | "onboarding"
  | "employee-management"
  | "offboarding"
  | "attendance"
  | "leave"
  | "workflow"
  | "reimbursement"
  | "advances"
  | "payroll"
  | "tax"
  | "policy"
  | "documents"
  | "contract"
  | "tasks"
  | "crm"
  | "assets";

export type CompanyHubTab = {
  id: string;
  label: string;
  embed?:
    | "dashboard"
    | "hierarchy"
    | "employees"
    | "departments"
    | "designations"
    | "holidays"
    | "termination"
    | "work-shifts"
    | "attendance-policy"
    | "roster"
    | "regularisation"
    | "leave-policy"
    | "leave-applications"
    | "public-holiday"
    | "workflows"
    | "reimbursement"
    | "salary-advance"
    | "generate-salary"
    | "compliance"
    | "company-setup"
    | "policy-setup"
    | "document-templates"
    | "contractors"
    | "tasks"
    | "promotions"
    | "reports"
    | "new-joiners"
    | "payroll-setup"
    | "salary-allowances"
    | "salary-deductions"
    | "salary-cycle"
    | "paygrade"
    | "forms"
    | "email-templates"
    | "company-info";
  comingSoon?: boolean;
};

export type CompanyHubTile = {
  id: CompanyHubId;
  label: string;
  icon: string;
  iconClassName: string;
  tabs: CompanyHubTab[];
};

export const COMPANY_HUB_TILES: CompanyHubTile[] = [
  {
    id: "company",
    label: "My Company",
    icon: "solar:buildings-2-bold-duotone",
    iconClassName: "text-sky-700",
    tabs: [
      { id: "dashboard", label: "Dashboard", embed: "dashboard" },
      { id: "hierarchy", label: "Company Hierarchy", embed: "hierarchy" },
      { id: "directory", label: "Employee Directory", embed: "employees" },
      { id: "holidays", label: "Holiday Calendar", embed: "public-holiday" },
    ],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    icon: "solar:user-plus-bold-duotone",
    iconClassName: "text-emerald-700",
    tabs: [
      { id: "candidates", label: "Candidate List", embed: "new-joiners" },
      { id: "assessments", label: "Assessments", comingSoon: true },
      { id: "interviews", label: "Interviews", comingSoon: true },
      { id: "offers", label: "Offers", comingSoon: true },
      { id: "onboarding", label: "Onboarding", embed: "new-joiners" },
      { id: "review", label: "Under Review", comingSoon: true },
    ],
  },
  {
    id: "employee-management",
    label: "Employee Management",
    icon: "solar:users-group-rounded-bold-duotone",
    iconClassName: "text-indigo-700",
    tabs: [
      { id: "employees", label: "Employees", embed: "employees" },
      { id: "departments", label: "Departments", embed: "departments" },
      { id: "designations", label: "Designations", embed: "designations" },
      { id: "transitions", label: "Transitions", embed: "promotions" },
      { id: "reports", label: "Reports", embed: "reports" },
    ],
  },
  {
    id: "offboarding",
    label: "Offboarding",
    icon: "solar:user-minus-bold-duotone",
    iconClassName: "text-rose-700",
    tabs: [{ id: "records", label: "Offboarding", embed: "termination" }],
  },
  {
    id: "attendance",
    label: "Attendance Management",
    icon: "solar:calendar-bold-duotone",
    iconClassName: "text-cyan-700",
    tabs: [
      { id: "shifts", label: "Work Shifts", embed: "work-shifts" },
      { id: "policy", label: "Attendance Policy", embed: "attendance-policy" },
      { id: "roster", label: "Roster", embed: "roster" },
      { id: "regularisation", label: "Regularisation", embed: "regularisation" },
    ],
  },
  {
    id: "leave",
    label: "Leave Management",
    icon: "solar:calendar-date-bold-duotone",
    iconClassName: "text-teal-700",
    tabs: [
      { id: "applications", label: "Leave Applications", embed: "leave-applications" },
      { id: "policy", label: "Leave Policy", embed: "leave-policy" },
      { id: "holidays", label: "Holidays", embed: "holidays" },
      { id: "public-holiday", label: "Public Holiday", embed: "public-holiday" },
    ],
  },
  {
    id: "workflow",
    label: "Workflow Management",
    icon: "solar:share-circle-bold-duotone",
    iconClassName: "text-violet-700",
    tabs: [{ id: "workflows", label: "Approval Workflows", embed: "workflows" }],
  },
  {
    id: "reimbursement",
    label: "Claim & Reimbursement",
    icon: "solar:wallet-bold-duotone",
    iconClassName: "text-amber-700",
    tabs: [{ id: "claims", label: "Reimbursements", embed: "reimbursement" }],
  },
  {
    id: "advances",
    label: "Advances & Loan",
    icon: "solar:hand-money-bold-duotone",
    iconClassName: "text-orange-700",
    tabs: [{ id: "advances", label: "Salary Advances", embed: "salary-advance" }],
  },
  {
    id: "payroll",
    label: "Payroll Management",
    icon: "solar:bill-bold-duotone",
    iconClassName: "text-lime-700",
    tabs: [
      { id: "run", label: "Run Payroll", embed: "generate-salary" },
      { id: "cycle", label: "Salary Cycle", embed: "salary-cycle" },
      { id: "allowances", label: "Allowances", embed: "salary-allowances" },
      { id: "deductions", label: "Deductions", embed: "salary-deductions" },
      { id: "paygrade", label: "Paygrade", embed: "paygrade" },
      { id: "setup", label: "Payroll Setup", embed: "payroll-setup" },
    ],
  },
  {
    id: "tax",
    label: "Tax & Compliance",
    icon: "solar:shield-check-bold-duotone",
    iconClassName: "text-emerald-800",
    tabs: [
      { id: "company-info", label: "Company Information", embed: "company-info" },
      { id: "compliance", label: "Registrations & Certificates", embed: "compliance" },
    ],
  },
  {
    id: "policy",
    label: "Policy Manager",
    icon: "solar:document-text-bold-duotone",
    iconClassName: "text-fuchsia-700",
    tabs: [
      { id: "shifts", label: "Workshift", embed: "work-shifts" },
      { id: "attendance-policy", label: "Attendance Policy", embed: "attendance-policy" },
      { id: "holidays", label: "Manage Holidays", embed: "holidays" },
      { id: "leave-policy", label: "Leave Policy", embed: "leave-policy" },
      { id: "setup", label: "Other Policy", embed: "policy-setup" },
    ],
  },
  {
    id: "documents",
    label: "Documents & Templates",
    icon: "solar:document-add-bold-duotone",
    iconClassName: "text-indigo-700",
    tabs: [
      { id: "templates", label: "Document Templates", embed: "document-templates" },
      { id: "forms", label: "Forms", embed: "forms" },
      { id: "email", label: "Email Templates", embed: "email-templates" },
    ],
  },
  {
    id: "contract",
    label: "Contract Management",
    icon: "solar:case-bold-duotone",
    iconClassName: "text-stone-700",
    tabs: [{ id: "contractors", label: "Contractors", embed: "contractors" }],
  },
  {
    id: "tasks",
    label: "Task Management",
    icon: "solar:checklist-bold-duotone",
    iconClassName: "text-fuchsia-700",
    tabs: [{ id: "tasks", label: "Tasks", embed: "tasks" }],
  },
  {
    id: "crm",
    label: "CRM",
    icon: "solar:dialog-bold-duotone",
    iconClassName: "text-pink-700",
    tabs: [{ id: "crm", label: "CRM", comingSoon: true }],
  },
  {
    id: "assets",
    label: "Asset Management",
    icon: "solar:box-bold-duotone",
    iconClassName: "text-gray-700",
    tabs: [{ id: "assets", label: "Assets", comingSoon: true }],
  },
];

export function getCompanyHub(id: string | undefined) {
  return COMPANY_HUB_TILES.find((hub) => hub.id === id) ?? null;
}
