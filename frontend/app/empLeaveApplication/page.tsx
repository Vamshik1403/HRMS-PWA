"use client";

import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpLeaveMobile } from "../components/emp/EmpLeaveMobile";
import { EmpDesktopWorkspaceGate } from "../components/emp/EmpDesktopWorkspaceGate";
import { EmpLeaveWorkspace } from "../components/emp/workspaces/EmpLeaveWorkspace";

export default function EmpLeaveApplicationPage() {
  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate
        workspace={<EmpLeaveWorkspace />}
        mobile={<EmpLeaveMobile />}
      />
    </EmpMobileLayout>
  );
}
