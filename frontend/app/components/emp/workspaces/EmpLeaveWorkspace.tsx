"use client";

import { Calendar } from "lucide-react";
import { EmpLeaveMobile } from "../EmpLeaveMobile";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";
import { EmpDesktopPage } from "../desktop/EmpDesktopPage";

export function EmpLeaveWorkspace() {
  return (
    <EmpWorkspaceContent>
      <EmpDesktopPage
        title="Leave"
        description="Leave balance and application history"
        icon={Calendar}
      >
        <EmpLeaveMobile desktopTab="overview" embedded compactBalance />
      </EmpDesktopPage>
    </EmpWorkspaceContent>
  );
}
