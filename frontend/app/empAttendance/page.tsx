"use client";

import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpDesktopWorkspaceGate } from "../components/emp/EmpDesktopWorkspaceGate";
import { EmpAttendanceWorkspace } from "../components/emp/workspaces/EmpAttendanceWorkspace";
import EmpAttendanceMobilePage from "./EmpAttendanceMobilePage";

export default function EmpAttendancePage() {
  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate
        workspace={<EmpAttendanceWorkspace />}
        mobile={<EmpAttendanceMobilePage />}
      />
    </EmpMobileLayout>
  );
}
