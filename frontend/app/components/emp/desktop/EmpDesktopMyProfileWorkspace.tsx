"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { User } from "lucide-react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { EmpDesktopProfilePanel } from "./EmpDesktopProfilePanel";
import { EmpDesktopProfileSettings } from "./EmpDesktopProfileSettings";
import { EmpProfileWorkspaceTabNav, profileTabHref, resolveProfileWorkspaceTab } from "./EmpProfileWorkspaceTabNav";
import { EmpWorkspaceApprovals } from "../EmpWorkspaceApprovals";
import { EmpWorkspacePromotions } from "../EmpWorkspacePromotions";
import { EmpWorkspaceDelegation } from "../EmpWorkspaceDelegation";
import { EmpLeaveMobile } from "../EmpLeaveMobile";
import { EmpAttendanceWorkspace } from "../workspaces/EmpAttendanceWorkspace";
import { useEmpManagerScope } from "../../../hooks/useEmpManagerScope";
import { Icon } from "@iconify/react";

function EmpDesktopMyProfileWorkspaceInner() {
  const searchParams = useSearchParams();
  const { isManagerView } = useEmpManagerScope();
  const activeTab = resolveProfileWorkspaceTab(searchParams);

  const tabs = [
    { id: "profile", label: "Profile", href: profileTabHref("profile") },
    { id: "approvals", label: "Approvals", href: profileTabHref("approvals") },
    { id: "leave", label: "Leave", href: profileTabHref("leave") },
    { id: "attendance", label: "Attendance", href: profileTabHref("attendance") },
    ...(isManagerView
      ? [
          { id: "promotions", label: "Promotions & Transfer", href: profileTabHref("promotions") },
          { id: "delegation", label: "My Delegation", href: profileTabHref("delegation") },
        ]
      : [{ id: "delegation", label: "My Delegation", href: profileTabHref("delegation") }]),
  ];

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

        {activeTab === "approvals" && <EmpWorkspaceApprovals embedded />}
        {activeTab === "leave" && <EmpLeaveMobile desktopTab="overview" embedded />}
        {activeTab === "attendance" && <EmpAttendanceWorkspace embedded />}
        {activeTab === "promotions" && isManagerView && <EmpWorkspacePromotions embedded />}
        {activeTab === "delegation" && <EmpWorkspaceDelegation embedded />}
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
