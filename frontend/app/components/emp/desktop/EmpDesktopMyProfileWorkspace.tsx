"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { User } from "lucide-react";
import { Icon } from "@iconify/react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { EmpDesktopProfilePanel } from "./EmpDesktopProfilePanel";
import { EmpDesktopProfileSettings } from "./EmpDesktopProfileSettings";
import { EmpProfileWorkspaceTabNav, profileTabHref, resolveProfileWorkspaceTab } from "./EmpProfileWorkspaceTabNav";
import { EmpWorkspaceDelegation } from "../EmpWorkspaceDelegation";
import { EmpLeaveMobile } from "../EmpLeaveMobile";
import { EmpReimbursementMobile } from "../EmpReimbursementMobile";
import { EmpProfileAttendanceView } from "./EmpProfileAttendanceView";
import { EmpProfileWorkReportView } from "./EmpProfileWorkReportView";
import { EmpPayoutContent } from "../EmpPayoutContent";
import { EmpProfileSalaryAdvancePanel } from "../EmpProfileSalaryAdvancePanel";
import { EmpProfileMessagingPanel } from "../EmpProfileMessagingPanel";
import { EmpHolidayListMobile } from "../EmpHolidayListMobile";
import { getPageCache, setPageCache } from "../../../utils/pageCache";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function EmpDesktopMyProfileWorkspaceInner() {
  const searchParams = useSearchParams();
  const activeTab = resolveProfileWorkspaceTab(searchParams);
  const [showLoanAdvances, setShowLoanAdvances] = useState<boolean>(() => {
    const cached = getPageCache<{ pwaShowLoanAdvances?: boolean }>("empProfileData");
    if (cached && typeof cached.pwaShowLoanAdvances === "boolean") {
      return cached.pwaShowLoanAdvances !== false;
    }
    return true;
  });

  useEffect(() => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
      const rawUser = localStorage.getItem("user");
      if (!rawUser) return;
      const user = JSON.parse(rawUser);
      const username = user?.username;
      const empId = user?.employee?.id ?? user?.employeeId ?? user?.id;
      const fromUser = user?.employee?.pwaShowLoanAdvances ?? user?.pwaShowLoanAdvances;
      if (typeof fromUser === "boolean") setShowLoanAdvances(fromUser !== false);

      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const applyFlag = (value: unknown) => {
        if (typeof value === "boolean") setShowLoanAdvances(value !== false);
      };

      const cached = getPageCache<{ pwaShowLoanAdvances?: boolean }>("empProfileData");
      if (cached && typeof cached.pwaShowLoanAdvances === "boolean") {
        applyFlag(cached.pwaShowLoanAdvances);
      }

      if (username) {
        fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(username)}`, { headers })
          .then((r) => (r.ok ? r.json() : null))
          .then((creds) => {
            applyFlag(creds?.employee?.pwaShowLoanAdvances);
          })
          .catch(() => {});
      }

      if (empId && token) {
        fetch(`${BACKEND}/manage-emp/${empId}`, { headers })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return;
            setPageCache("empProfileData", data);
            applyFlag(data.pwaShowLoanAdvances);
          })
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, []);

  const tabs = [
    { id: "profile", label: "Profile", href: profileTabHref("profile") },
    { id: "attendance", label: "Attendance", href: profileTabHref("attendance") },
    { id: "work-report", label: "Work Report", href: profileTabHref("work-report") },
    { id: "leave", label: "Leave", href: profileTabHref("leave") },
    { id: "reimbursement", label: "Reimbursement", href: profileTabHref("reimbursement") },
    { id: "payslips", label: "Payslip", href: profileTabHref("payslips") },
    ...(showLoanAdvances
      ? [{ id: "salary-advance", label: "Loan & Advances", href: profileTabHref("salary-advance") }]
      : []),
    { id: "holidays", label: "My Holidays", href: profileTabHref("holidays") },
    { id: "delegation", label: "My Delegations", href: profileTabHref("delegation") },
  ];

  const isMessaging = activeTab === "messaging";
  const showSalaryAdvanceTab = showLoanAdvances && activeTab === "salary-advance";

  return (
    <>
      <div
        className={
          isMessaging
            ? "flex h-[calc(100dvh-8.75rem)] max-h-[calc(100dvh-8.75rem)] min-h-0 flex-col overflow-hidden"
            : "hidden"
        }
        aria-hidden={!isMessaging}
      >
        <EmpProfileMessagingPanel active={isMessaging} />
      </div>

      {!isMessaging ? (
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
        {activeTab === "work-report" && <EmpProfileWorkReportView />}
        {activeTab === "leave" && <EmpLeaveMobile desktopTab="overview" embedded compactBalance />}
        {activeTab === "reimbursement" && <EmpReimbursementMobile desktopTab="overview" embedded />}
        {activeTab === "delegation" && <EmpWorkspaceDelegation embedded />}
        {activeTab === "payslips" && (
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading payslips…</div>}>
            <EmpPayoutContent embedded />
          </Suspense>
        )}
        {showSalaryAdvanceTab && <EmpProfileSalaryAdvancePanel />}
        {activeTab === "holidays" && <EmpHolidayListMobile embedded />}
      </div>
    </EmpDesktopPage>
      ) : null}
    </>
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
