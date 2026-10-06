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
  | "reports"
  | "tax"
  | "documents"
  | "contract"
  | "tasks"
  | "crm"
  | "assets";

export type CompanyHubTab = {
  id: string;
  label: string;
  /** Product modules that unlock this tab. Empty means the tab is not part of any plan. */
  productModules?: string[];
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
    | "company-info"
    | "branches"
    | "devices"
    | "federal-domain"
    | "import-attendance"
    | "customers"
    | "sites"
    | "payroll-reports"
    | "leave-reports"
    | "statutory-reports"
    | "contractor-reports";
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
      { id: "dashboard", label: "Dashboard", embed: "dashboard", productModules: ["EMPLOYEE_MANAGEMENT_MODULE"] },
      { id: "hierarchy", label: "Company Hierarchy", embed: "hierarchy", productModules: ["EMPLOYEE_MANAGEMENT_MODULE"] },
      { id: "branches", label: "Branches", embed: "branches", productModules: ["EMPLOYEE_MANAGEMENT_MODULE"] },
      { id: "devices", label: "Attendance Devices", embed: "devices", productModules: ["EMPLOYEE_MANAGEMENT_MODULE"] },
      { id: "federal-domain", label: "Federal Domain", embed: "federal-domain", productModules: ["EMPLOYEE_MANAGEMENT_MODULE"] },
      { id: "directory", label: "Employee Directory", embed: "employees", productModules: ["EMPLOYEE_MANAGEMENT_MODULE"] },
      { id: "holidays", label: "Holiday Calendar", embed: "public-holiday", productModules: ["HOLIDAY_MODULE"] },
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
      { id: "employees", label: "Employees", embed: "employees", productModules: ["EMPLOYEE_MANAGEMENT_MODULE"] },
      { id: "departments", label: "Departments", embed: "departments", productModules: ["EMPLOYEE_MANAGEMENT_MODULE"] },
      { id: "designations", label: "Designations", embed: "designations", productModules: ["EMPLOYEE_MANAGEMENT_MODULE"] },
      { id: "transitions", label: "Transitions", embed: "promotions", productModules: ["PROMOTIONS_MODULE", "TRANSFERS_MODULE"] },
      { id: "reports", label: "Reports", embed: "reports", productModules: ["ADVANCE_REPORTING_MODULE"] },
    ],
  },
  {
    id: "offboarding",
    label: "Offboarding",
    icon: "solar:user-minus-bold-duotone",
    iconClassName: "text-rose-700",
    tabs: [{ id: "records", label: "Offboarding", embed: "termination", productModules: ["OFF_BOARDING_MODULE"] }],
  },
  {
    id: "attendance",
    label: "Attendance Management",
    icon: "solar:calendar-bold-duotone",
    iconClassName: "text-cyan-700",
    tabs: [
      { id: "shifts", label: "Work Shifts", embed: "work-shifts", productModules: ["WORKSHIFT_ROSTER_MODULE"] },
      { id: "policy", label: "Attendance Policy", embed: "attendance-policy", productModules: ["ATTENDANCE_POLICY_MODULE"] },
      { id: "roster", label: "Roster", embed: "roster", productModules: ["WORKSHIFT_ROSTER_MODULE"] },
      { id: "regularisation", label: "Regularisation", embed: "regularisation", productModules: ["REGULARISATION_MODULE"] },
      { id: "import", label: "Import Attendance", embed: "import-attendance" },
    ],
  },
  {
    id: "leave",
    label: "Leave Management",
    icon: "solar:calendar-date-bold-duotone",
    iconClassName: "text-teal-700",
    tabs: [
      { id: "applications", label: "Leave Applications", embed: "leave-applications", productModules: ["LEAVE_MODULE"] },
      { id: "policy", label: "Leave Policy", embed: "leave-policy", productModules: ["LEAVE_MODULE"] },
      { id: "public-holiday", label: "Public Holiday", embed: "public-holiday", productModules: ["HOLIDAY_MODULE"] },
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
    tabs: [{ id: "claims", label: "Reimbursements", embed: "reimbursement", productModules: ["REIMBURSEMENT_MODULE"] }],
  },
  {
    id: "advances",
    label: "Advances & Loan",
    icon: "solar:hand-money-bold-duotone",
    iconClassName: "text-orange-700",
    tabs: [{ id: "advances", label: "Salary Advances", embed: "salary-advance", productModules: ["LOAN_ADVANCE_MODULE"] }],
  },
  {
    id: "payroll",
    label: "Payroll Management",
    icon: "solar:bill-bold-duotone",
    iconClassName: "text-lime-700",
    tabs: [
      { id: "run", label: "Run Payroll", embed: "generate-salary", productModules: ["PAYROLL_MODULE"] },
      { id: "cycle", label: "Salary Cycle", embed: "salary-cycle", productModules: ["PAYROLL_MODULE"] },
      { id: "allowances", label: "Allowances", embed: "salary-allowances", productModules: ["PAYROLL_MODULE"] },
      { id: "deductions", label: "Deductions", embed: "salary-deductions", productModules: ["PAYROLL_MODULE"] },
      { id: "paygrade", label: "Paygrade", embed: "paygrade", productModules: ["PAYROLL_MODULE"] },
      { id: "setup", label: "Payroll Setup", embed: "payroll-setup", productModules: ["PAYROLL_MODULE"] },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "solar:chart-bold-duotone",
    iconClassName: "text-blue-700",
    tabs: [
      { id: "attendance", label: "Attendance Reports", embed: "reports", productModules: ["ADVANCE_REPORTING_MODULE"] },
      { id: "leave", label: "Leave Reports", embed: "leave-reports", productModules: ["ADVANCE_REPORTING_MODULE"] },
      { id: "payroll", label: "Payroll Reports", embed: "payroll-reports", productModules: ["ADVANCE_REPORTING_MODULE"] },
      { id: "statutory", label: "Statutory Reports", embed: "statutory-reports", productModules: ["ADVANCE_REPORTING_MODULE"] },
      { id: "contractor", label: "Contractor Reports", embed: "contractor-reports", productModules: ["ADVANCE_REPORTING_MODULE"] },
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
    tabs: [{ id: "contractors", label: "Contractors", embed: "contractors", productModules: ["CONTRACTOR_MODULE"] }],
  },
  {
    id: "tasks",
    label: "Task Management",
    icon: "solar:checklist-bold-duotone",
    iconClassName: "text-fuchsia-700",
    tabs: [
      { id: "tasks", label: "Tasks", embed: "tasks", productModules: ["TASK_MODULE"] },
      { id: "customers", label: "Customers", embed: "customers", productModules: ["TASK_MODULE"] },
      { id: "sites", label: "Sites", embed: "sites", productModules: ["ONFIELD_TASK_MODULE", "TASK_MODULE"] },
    ],
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

export function filterCompanyHubTiles(
  tiles: CompanyHubTile[],
  tabAllowed: (productModules?: string[]) => boolean,
): CompanyHubTile[] {
  return tiles
    .map((tile) => ({
      ...tile,
      tabs: tile.tabs.filter((tab) => tabAllowed(tab.productModules)),
    }))
    .filter((tile) => tile.tabs.length > 0);
}
