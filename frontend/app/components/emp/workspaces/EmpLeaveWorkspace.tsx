"use client";

import { EmpLeaveMobile } from "../EmpLeaveMobile";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";

export function EmpLeaveWorkspace() {
  return (
    <EmpWorkspaceContent>
      <EmpLeaveMobile desktopTab="overview" />
    </EmpWorkspaceContent>
  );
}
