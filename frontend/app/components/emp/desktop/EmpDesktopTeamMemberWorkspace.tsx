"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { User } from "lucide-react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { EmpDesktopProfilePanel } from "./EmpDesktopProfilePanel";
import { EmpProfileWorkspaceTabNav } from "./EmpProfileWorkspaceTabNav";
import { EmpProfileAttendanceView } from "./EmpProfileAttendanceView";
import { EmpProfileWorkReportView } from "./EmpProfileWorkReportView";
import { EmpProfileRegularisationView } from "./EmpProfileRegularisationView";
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

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const MEMBER_TABS = [
  "profile",
  "attendance",
  "work-report",
  "leave",
  "reimbursement",
  "regularisation",
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

function scrollMemberWorkspaceToTop() {
  const el = document.querySelector(".emp-portal-main");
  el?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  window.scrollTo(0, 0);
}

function EmpDesktopTeamMemberWorkspaceInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const employeeId = Number(params.id);
  const activeTab = resolveMemberTab(searchParams);
  const [employeeName, setEmployeeName] = useState("Employee profile");

  useLayoutEffect(() => {
    if (!employeeId || Number.isNaN(employeeId)) return;
    scrollMemberWorkspaceToTop();
    const raf = requestAnimationFrame(() => scrollMemberWorkspaceToTop());
    return () => cancelAnimationFrame(raf);
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId || Number.isNaN(employeeId)) return;
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
        : "";
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${BACKEND}/manage-emp/${employeeId}`, { headers, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const name = [data?.employeeFirstName, data?.employeeLastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (name) setEmployeeName(name);
      })
      .catch(() => {});
  }, [employeeId]);

  if (!employeeId || Number.isNaN(employeeId)) {
    return (
      <EmpDesktopPage title="Employee profile" description="Employee not found" icon={User}>
        <p className="text-sm text-muted-foreground">Invalid employee.</p>
      </EmpDesktopPage>
    );
  }

  const tabs = [
    { id: "profile", label: "Profile", href: memberTabHref(employeeId, "profile") },
    { id: "attendance", label: "Attendance", href: memberTabHref(employeeId, "attendance") },
    { id: "work-report", label: "Work Report", href: memberTabHref(employeeId, "work-report") },
    { id: "leave", label: "Leave", href: memberTabHref(employeeId, "leave") },
    { id: "reimbursement", label: "Reimbursement", href: memberTabHref(employeeId, "reimbursement") },
    { id: "regularisation", label: "Regularisation", href: memberTabHref(employeeId, "regularisation") },
    { id: "payslips", label: "Payslips", href: memberTabHref(employeeId, "payslips") },
    { id: "salary-advance", label: "Loans & Advances", href: memberTabHref(employeeId, "salary-advance") },
    { id: "messaging", label: "IM", href: memberTabHref(employeeId, "messaging") },
    { id: "holidays", label: "My Holidays", href: memberTabHref(employeeId, "holidays") },
    { id: "promotions", label: "Promotions & Transfer", href: memberTabHref(employeeId, "promotions") },
  ];

  return (
    <EmpDesktopPage title={employeeName} description="Employee profile and workspace sections" icon={User}>
      <div className="space-y-3">
        <EmpProfileWorkspaceTabNav tabs={tabs} activeTab={activeTab} />

        {activeTab === "profile" && (
          <EmpDesktopProfilePanel embedded employeeId={employeeId} readOnly />
        )}
        {activeTab === "attendance" && <EmpProfileAttendanceView employeeId={employeeId} />}
        {activeTab === "work-report" && <EmpProfileWorkReportView employeeId={employeeId} />}
        {activeTab === "leave" && <EmpTeamMemberLeave employeeId={employeeId} />}
        {activeTab === "reimbursement" && <EmpTeamMemberReimbursement employeeId={employeeId} />}
        {activeTab === "regularisation" && (
          <EmpProfileRegularisationView employeeId={employeeId} />
        )}
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
