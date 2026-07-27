"use client";

import { EmpReimbursementMobile } from "../EmpReimbursementMobile";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";

export function EmpReimbursementWorkspace() {
  return (
    <EmpWorkspaceContent>
      <EmpReimbursementMobile desktopTab="overview" />
    </EmpWorkspaceContent>
  );
}
