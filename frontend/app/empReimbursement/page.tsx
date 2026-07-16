"use client";

import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpReimbursementMobile } from "../components/emp/EmpReimbursementMobile";
import { EmpDesktopWorkspaceGate } from "../components/emp/EmpDesktopWorkspaceGate";
import { EmpReimbursementWorkspace } from "../components/emp/workspaces/EmpReimbursementWorkspace";

export default function EmpReimbursementPage() {
  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate
        workspace={<EmpReimbursementWorkspace />}
        mobile={<EmpReimbursementMobile />}
      />
    </EmpMobileLayout>
  );
}
