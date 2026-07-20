"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmpProfileWorkspaceTabNav, profileTabHref, resolveProfileWorkspaceTab } from "./desktop/EmpProfileWorkspaceTabNav";
import { EmpDesktopProfilePanel } from "./desktop/EmpDesktopProfilePanel";
import { EmpProfileAttendanceView } from "./desktop/EmpProfileAttendanceView";
import { EmpLeaveMobile } from "./EmpLeaveMobile";
import { EmpReimbursementMobile } from "./EmpReimbursementMobile";
import { EmpWorkspaceDelegation } from "./EmpWorkspaceDelegation";
import { EmpPayoutContent } from "./EmpPayoutContent";
import { EmpProfileSalaryAdvancePanel } from "./EmpProfileSalaryAdvancePanel";
import { EmpProfileMessagingPanel } from "./EmpProfileMessagingPanel";
import { EmpHolidayListMobile } from "./EmpHolidayListMobile";
import { Icon } from "@iconify/react";

function EmpProfileMobileWorkspaceInner() {
  const searchParams = useSearchParams();
  const activeTab = resolveProfileWorkspaceTab(searchParams);

  const tabs = [
    { id: "profile", label: "Profile", href: profileTabHref("profile") },
    { id: "attendance", label: "Attendance", href: profileTabHref("attendance") },
    { id: "leave", label: "Leave", href: profileTabHref("leave") },
    { id: "reimbursement", label: "Reimbursement", href: profileTabHref("reimbursement") },
    { id: "delegation", label: "Delegation", href: profileTabHref("delegation") },
    { id: "payslips", label: "Payslips", href: profileTabHref("payslips") },
    { id: "salary-advance", label: "Advances", href: profileTabHref("salary-advance") },
    { id: "messaging", label: "IM", href: profileTabHref("messaging") },
    { id: "holidays", label: "Holidays", href: profileTabHref("holidays") },
  ];

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/empdashboard" className="text-sm font-medium text-primary">
          ← Home
        </Link>
      </div>
      <h1 className="text-[22px] font-bold text-gray-900">My Profile</h1>
      <EmpProfileWorkspaceTabNav tabs={tabs} activeTab={activeTab} />

      {activeTab === "profile" && <EmpDesktopProfilePanel embedded />}
      {activeTab === "attendance" && <EmpProfileAttendanceView />}
      {activeTab === "leave" && <EmpLeaveMobile embedded compactBalance />}
      {activeTab === "reimbursement" && <EmpReimbursementMobile embedded />}
      {activeTab === "delegation" && <EmpWorkspaceDelegation embedded />}
      {activeTab === "payslips" && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <EmpPayoutContent embedded />
        </Suspense>
      )}
      {activeTab === "salary-advance" && <EmpProfileSalaryAdvancePanel />}
      {activeTab === "messaging" && <EmpProfileMessagingPanel />}
      {activeTab === "holidays" && <EmpHolidayListMobile embedded />}
    </div>
  );
}

export function EmpProfileMobileWorkspace() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex justify-center">
          <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      }
    >
      <EmpProfileMobileWorkspaceInner />
    </Suspense>
  );
}
