"use client";

import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpDesktopWorkspaceGate } from "../components/emp/EmpDesktopWorkspaceGate";
import { EmpDesktopMyProfileWorkspace } from "../components/emp/desktop/EmpDesktopMyProfileWorkspace";
import { EmpProfileMobileWorkspace } from "../components/emp/EmpProfileMobileWorkspace";

export default function EmpProfilePage() {
  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate
        workspace={<EmpDesktopMyProfileWorkspace />}
        mobile={<EmpProfileMobileWorkspace />}
      />
    </EmpMobileLayout>
  );
}
