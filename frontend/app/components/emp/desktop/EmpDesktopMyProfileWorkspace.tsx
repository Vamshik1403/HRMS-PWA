"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { User, MessageSquare } from "lucide-react";
import { Icon } from "@iconify/react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { EmpDesktopProfilePanel } from "./EmpDesktopProfilePanel";
import { EmpDesktopProfileSettings } from "./EmpDesktopProfileSettings";
import { EmpProfileWorkspaceTabNav, profileTabHref, resolveProfileWorkspaceTab } from "./EmpProfileWorkspaceTabNav";
import { EmpWorkspaceDelegation } from "../EmpWorkspaceDelegation";
import { EmpLeaveMobile } from "../EmpLeaveMobile";
import { EmpReimbursementMobile } from "../EmpReimbursementMobile";
import { EmpProfileAttendanceView } from "./EmpProfileAttendanceView";
import { EmpPayoutContent } from "../EmpPayoutContent";
import { EmpProfileSalaryAdvancePanel } from "../EmpProfileSalaryAdvancePanel";
import { EmpProfileMessagingPanel } from "../EmpProfileMessagingPanel";
import { EmpHolidayListMobile } from "../EmpHolidayListMobile";

function EmpDesktopMyProfileWorkspaceInner() {
  const searchParams = useSearchParams();
  const activeTab = resolveProfileWorkspaceTab(searchParams);

  const tabs = [
    { id: "profile", label: "Profile", href: profileTabHref("profile") },
    { id: "attendance", label: "Attendance", href: profileTabHref("attendance") },
    { id: "leave", label: "Leave", href: profileTabHref("leave") },
    { id: "reimbursement", label: "Reimbursement", href: profileTabHref("reimbursement") },
    { id: "delegation", label: "My Delegation", href: profileTabHref("delegation") },
    { id: "payslips", label: "Payslips", href: profileTabHref("payslips") },
    { id: "salary-advance", label: "Loans & Advances", href: profileTabHref("salary-advance") },
    { id: "holidays", label: "My Holidays", href: profileTabHref("holidays") },
  ];

  if (activeTab === "messaging") {
    return (
      <EmpDesktopPage title="IM" description="Team communications and general messages" icon={MessageSquare}>
        <EmpProfileMessagingPanel />
      </EmpDesktopPage>
    );
  }

  return (
    <EmpDesktopPage title="My Profile" description="Your employee information and workspace sections" icon={User}>
      <div className="space-y-6">
        <EmpProfileWorkspaceTabNav tabs={tabs} activeTab={activeTab} />

        {activeTab === "profile" && (
          <div className="space-y-6">
            <EmpDesktopProfilePanel embedded />
            <EmpDesktopProfileSettings />
          </div>
        )}

        {activeTab === "attendance" && <EmpProfileAttendanceView />}
        {activeTab === "leave" && <EmpLeaveMobile desktopTab="overview" embedded compactBalance />}
        {activeTab === "reimbursement" && <EmpReimbursementMobile desktopTab="overview" embedded />}
        {activeTab === "delegation" && <EmpWorkspaceDelegation embedded />}
        {activeTab === "payslips" && (
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading payslips…</div>}>
            <EmpPayoutContent embedded />
          </Suspense>
        )}
        {activeTab === "salary-advance" && <EmpProfileSalaryAdvancePanel />}
        {activeTab === "holidays" && <EmpHolidayListMobile embedded />}
      </div>
    </EmpDesktopPage>
  );
}

function ProfileWorkspaceFallback() {
  return (
    <div className="p-8 flex justify-center">
      <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 animate-spin text-blue-400" />
    </div>
  );
}

export function EmpDesktopMyProfileWorkspace() {
  return (
    <Suspense fallback={<ProfileWorkspaceFallback />}>
      <EmpDesktopMyProfileWorkspaceInner />
    </Suspense>
  );
}
