"use client";

import { Wallet } from "lucide-react";
import { EmpReimbursementMobile } from "../EmpReimbursementMobile";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";
import { EmpDesktopPage } from "../desktop/EmpDesktopPage";

export function EmpReimbursementWorkspace() {
  return (
    <EmpWorkspaceContent>
      <EmpDesktopPage
        title="Reimbursement"
        description="Track and submit reimbursement claims"
        icon={Wallet}
      >
        <EmpReimbursementMobile desktopTab="overview" embedded />
      </EmpDesktopPage>
    </EmpWorkspaceContent>
  );
}
