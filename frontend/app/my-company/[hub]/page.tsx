"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/app/components/app/page-header";
import { cn } from "@/app/utils/cn";
import { getCompanyHub, type CompanyHubTab } from "../hubs";

const EmpCompanyDashboard = dynamic(
  () =>
    import("@/app/components/emp/EmpCompanyEnterpriseHome").then(
      (m) => m.EmpCompanyEnterpriseHome,
    ),
  { ssr: false },
);
const CompanyHierarchyPage = dynamic(() => import("../../company-hierarchy/page"), { ssr: false });
const ManageEmployeesManagement = dynamic(
  () => import("../../manage-employees/ManageEmployeesManagement").then((m) => m.ManageEmployeesManagement),
  { ssr: false },
);
const DepartmentManagement = dynamic(
  () => import("../../departments/DepartmentManagement").then((m) => m.DepartmentManagement),
  { ssr: false },
);
const DesignationManagement = dynamic(
  () => import("../../designations/DesignationManagement").then((m) => m.DesignationManagement),
  { ssr: false },
);
const ManageHolidaysManagement = dynamic(
  () => import("../../manage-holidays/ManageHolidaysManagement").then((m) => m.ManageHolidaysManagement),
  { ssr: false },
);
const TerminationPage = dynamic(() => import("../../termination/page"), { ssr: false });
const WorkShiftsPage = dynamic(() => import("../../work-shifts/page"), { ssr: false });
const AttendancePolicyPage = dynamic(() => import("../../attendance-policy/page"), { ssr: false });
const RosterPage = dynamic(() => import("../../roster/page"), { ssr: false });
const RegularisationPage = dynamic(() => import("../../attendance-regularisation/page"), { ssr: false });
const LeavePolicyPage = dynamic(() => import("../../leave-policy/page"), { ssr: false });
const LeaveApplicationsPage = dynamic(() => import("../../leave-applications/page"), { ssr: false });
const PublicHolidayPage = dynamic(() => import("../../public-holiday/page"), { ssr: false });
const WorkflowsPage = dynamic(() => import("../../approval-workflows/page"), { ssr: false });
const ReimbursementPage = dynamic(() => import("../../reimbursement/page"), { ssr: false });
const SalaryAdvancePage = dynamic(() => import("../../salary-advance/page"), { ssr: false });
const GenerateSalaryPage = dynamic(() => import("../../generate-salary/page"), { ssr: false });
const CompliancePage = dynamic(() => import("../../system-settings/compliance/page"), { ssr: false });
const PolicySetupPage = dynamic(() => import("../../policy-setup/page"), { ssr: false });
const DocumentTemplatesPage = dynamic(() => import("../../document-templates/page"), { ssr: false });
const ContractorsPage = dynamic(() => import("../../contractors/page"), { ssr: false });
const TasksPage = dynamic(() => import("../../task-projects/page"), { ssr: false });
const PromotionsPage = dynamic(() => import("../../employees-promotions/page"), { ssr: false });
const ReportsPage = dynamic(() => import("../../attendance-reports/page"), { ssr: false });
const LeaveReportsPage = dynamic(() => import("../../leave-reports/page"), { ssr: false });
const PayrollReportsPage = dynamic(() => import("../../payroll-reports/page"), { ssr: false });
const StatutoryReportsPage = dynamic(() => import("../../statutory-reports/page"), { ssr: false });
const ContractorReportsPage = dynamic(() => import("../../contractor-reports/page"), { ssr: false });
const NewJoinersPage = dynamic(() => import("../../new-joiners/page"), { ssr: false });
const PayrollSetupPage = dynamic(() => import("../../payroll-setup/page"), { ssr: false });
const SalaryAllowancesPage = dynamic(() => import("../../salary-allowances/page"), { ssr: false });
const SalaryDeductionsPage = dynamic(() => import("../../salary-deductions/page"), { ssr: false });
const SalaryCyclePage = dynamic(() => import("../../monthly-salary-cycle/page"), { ssr: false });
const PaygradePage = dynamic(() => import("../../monthly-pay-grade/page"), { ssr: false });
const FormsPage = dynamic(() => import("../../forms/page"), { ssr: false });
const EmailTemplatesPage = dynamic(() => import("../../system-settings/email-templates/page"), { ssr: false });
const CompanyInfoPage = dynamic(() => import("../../system-settings/general/page"), { ssr: false });
const BranchManagement = dynamic(
  () => import("../../branches/BranchManagement").then((m) => m.BranchManagement),
  { ssr: false },
);
const DeviceManagement = dynamic(
  () => import("../../devices/DeviceManagement").then((m) => m.DeviceManagement),
  { ssr: false },
);
const FederalDomainManagement = dynamic(
  () =>
    import("../../federal-domain/FederalDomainManagement").then(
      (m) => m.FederalDomainManagement,
    ),
  { ssr: false },
);
const ImportAttendanceManagement = dynamic(
  () =>
    import("../../import-attendance/ImportAttendanceManagement").then(
      (m) => m.ImportAttendanceManagement,
    ),
  { ssr: false },
);
const CustomerManagement = dynamic(
  () => import("../../task-customers/CustomerManagement"),
  { ssr: false },
);
const SiteManagement = dynamic(
  () => import("../../task-customer-sites/SiteManagement"),
  { ssr: false },
);

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
      {label} is coming soon.
    </div>
  );
}

function HubEmbed({ tab }: { tab: CompanyHubTab }) {
  if (tab.comingSoon || !tab.embed) return <ComingSoon label={tab.label} />;

  switch (tab.embed) {
    case "dashboard":
      return <EmpCompanyDashboard />;
    case "hierarchy":
      return <CompanyHierarchyPage />;
    case "employees":
      return <ManageEmployeesManagement />;
    case "departments":
      return <DepartmentManagement />;
    case "designations":
      return <DesignationManagement />;
    case "holidays":
      return <ManageHolidaysManagement />;
    case "termination":
      return <TerminationPage />;
    case "work-shifts":
      return <WorkShiftsPage />;
    case "attendance-policy":
      return <AttendancePolicyPage />;
    case "roster":
      return <RosterPage />;
    case "regularisation":
      return <RegularisationPage />;
    case "leave-policy":
      return <LeavePolicyPage />;
    case "leave-applications":
      return <LeaveApplicationsPage />;
    case "public-holiday":
      return <PublicHolidayPage />;
    case "workflows":
      return <WorkflowsPage />;
    case "reimbursement":
      return <ReimbursementPage />;
    case "salary-advance":
      return <SalaryAdvancePage />;
    case "generate-salary":
      return <GenerateSalaryPage />;
    case "compliance":
      return <CompliancePage />;
    case "policy-setup":
      return <PolicySetupPage />;
    case "document-templates":
      return <DocumentTemplatesPage />;
    case "contractors":
      return <ContractorsPage />;
    case "tasks":
      return <TasksPage />;
    case "promotions":
      return <PromotionsPage />;
    case "reports":
      return <ReportsPage />;
    case "leave-reports":
      return <LeaveReportsPage />;
    case "payroll-reports":
      return <PayrollReportsPage />;
    case "statutory-reports":
      return <StatutoryReportsPage />;
    case "contractor-reports":
      return <ContractorReportsPage />;
    case "new-joiners":
      return <NewJoinersPage />;
    case "payroll-setup":
      return <PayrollSetupPage />;
    case "salary-allowances":
      return <SalaryAllowancesPage />;
    case "salary-deductions":
      return <SalaryDeductionsPage />;
    case "salary-cycle":
      return <SalaryCyclePage />;
    case "paygrade":
      return <PaygradePage />;
    case "forms":
      return <FormsPage />;
    case "email-templates":
      return <EmailTemplatesPage />;
    case "company-info":
      return <CompanyInfoPage />;
    case "branches":
      return <BranchManagement />;
    case "devices":
      return <DeviceManagement />;
    case "federal-domain":
      return <FederalDomainManagement />;
    case "import-attendance":
      return <ImportAttendanceManagement />;
    case "customers":
      return <CustomerManagement />;
    case "sites":
      return <SiteManagement />;
    default:
      return <ComingSoon label={tab.label} />;
  }
}

function CompanyHubPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hub = getCompanyHub(String(params.hub || ""));
  if (!hub) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Unknown module.{" "}
        <Link href="/my-company" className="text-primary underline">
          Back to My Company
        </Link>
      </div>
    );
  }

  const rawTab = searchParams.get("tab");
  const requested = hub.id === "leave" && rawTab === "holidays" ? "public-holiday" : rawTab;
  const activeId = requested || hub.tabs[0]?.id;
  const activeTab = hub.tabs.find((t) => t.id === activeId) || hub.tabs[0];

  return (
    <div className="page-content-enter w-full max-w-none animate-fade-in space-y-6">
      <PageHeader icon={Building2} title={hub.label} description="Use the tabs to open each section." />
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex gap-0.5 overflow-x-auto border-b border-border px-2">
          {hub.tabs.map((tab) => {
            const active = tab.id === activeTab.id;
            return (
              <Link
                key={tab.id}
                href={`/my-company/${hub.id}?tab=${tab.id}`}
                className={cn(
                  "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      {activeTab ? <HubEmbed tab={activeTab} /> : null}
    </div>
  );
}

export default function CompanyHubPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <CompanyHubPageInner />
    </Suspense>
  );
}
