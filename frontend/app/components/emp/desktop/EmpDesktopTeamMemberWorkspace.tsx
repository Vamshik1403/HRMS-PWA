"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { EmpDesktopProfilePanel } from "./EmpDesktopProfilePanel";
import { EmpProfileWorkspaceTabNav } from "./EmpProfileWorkspaceTabNav";
import { EmpProfileAttendanceView } from "./EmpProfileAttendanceView";
import { EmpHolidayListMobile } from "../EmpHolidayListMobile";
import {
  EmpTeamMemberLeave,
  EmpTeamMemberReimbursement,
  EmpTeamMemberPayslips,
  EmpTeamMemberSalaryAdvances,
  EmpTeamMemberMessaging,
  EmpTeamMemberPromotions,
} from "../EmpTeamMemberSections";
import { Icon } from "@iconify/react";

const MEMBER_TABS = [
  "profile",
  "attendance",
  "leave",
  "reimbursement",
  "payslips",
  "salary-advance",
  "messaging",
  "holidays",
  "promotions",
] as const;

type MemberTab = (typeof MEMBER_TABS)[number];

function memberTabHref(employeeId: number, tab: string) {
  return `/empTeam/member/${employeeId}?tab=${tab}`;
}

function resolveMemberTab(searchParams: URLSearchParams): MemberTab {
  const tab = searchParams.get("tab");
  if (tab && MEMBER_TABS.includes(tab as MemberTab)) {
    return tab as MemberTab;
  }
  return "profile";
}

function EmpDesktopTeamMemberWorkspaceInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const employeeId = Number(params.id);
  const activeTab = resolveMemberTab(searchParams);

  if (!employeeId || Number.isNaN(employeeId)) {
    return (
      <EmpDesktopPage title="Team member" description="Employee not found" icon={User}>
        <p className="text-sm text-muted-foreground">Invalid employee.</p>
      </EmpDesktopPage>
    );
  }

  const tabs = [
    { id: "profile", label: "Profile", href: memberTabHref(employeeId, "profile") },
    { id: "attendance", label: "Attendance", href: memberTabHref(employeeId, "attendance") },
    { id: "leave", label: "Leave", href: memberTabHref(employeeId, "leave") },
    { id: "reimbursement", label: "Reimbursement", href: memberTabHref(employeeId, "reimbursement") },
    { id: "payslips", label: "Payslips", href: memberTabHref(employeeId, "payslips") },
    { id: "salary-advance", label: "Loans & Advances", href: memberTabHref(employeeId, "salary-advance") },
    { id: "messaging", label: "IM", href: memberTabHref(employeeId, "messaging") },
    { id: "holidays", label: "My Holidays", href: memberTabHref(employeeId, "holidays") },
    { id: "promotions", label: "Promotions & Transfer", href: memberTabHref(employeeId, "promotions") },
  ];

  return (
    <EmpDesktopPage title="Team member" description="Employee profile and records" icon={User}>
      <div className="space-y-6">
        <Link
          href="/empTeam/my-team"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to My Team
        </Link>

        <EmpProfileWorkspaceTabNav tabs={tabs} activeTab={activeTab} />

        {activeTab === "profile" && (
          <EmpDesktopProfilePanel embedded employeeId={employeeId} readOnly />
        )}
        {activeTab === "attendance" && <EmpProfileAttendanceView employeeId={employeeId} />}
        {activeTab === "leave" && <EmpTeamMemberLeave employeeId={employeeId} />}
        {activeTab === "reimbursement" && <EmpTeamMemberReimbursement employeeId={employeeId} />}
        {activeTab === "payslips" && <EmpTeamMemberPayslips employeeId={employeeId} />}
        {activeTab === "salary-advance" && <EmpTeamMemberSalaryAdvances employeeId={employeeId} />}
        {activeTab === "messaging" && <EmpTeamMemberMessaging employeeId={employeeId} />}
        {activeTab === "holidays" && <EmpHolidayListMobile embedded />}
        {activeTab === "promotions" && <EmpTeamMemberPromotions employeeId={employeeId} />}
      </div>
    </EmpDesktopPage>
  );
}

function Fallback() {
  return (
    <div className="p-8 flex justify-center">
      <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 animate-spin text-blue-400" />
    </div>
  );
}

export function EmpDesktopTeamMemberWorkspace() {
  return (
    <Suspense fallback={<Fallback />}>
      <EmpDesktopTeamMemberWorkspaceInner />
    </Suspense>
  );
}
