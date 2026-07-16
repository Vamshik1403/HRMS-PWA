"use client";

import { Suspense, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { useEmpPortalLayout } from "../layout/EmpPortalShell";

function WorkspaceFallback() {
  return (
    <div className="p-8 flex justify-center">
      <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 animate-spin text-blue-400" />
    </div>
  );
}

/** Renders workspace on desktop portal; mobile content otherwise. */
export function EmpDesktopWorkspaceGate({
  workspace,
  mobile,
}: {
  workspace: ReactNode;
  mobile: ReactNode;
}) {
  const { desktop: isDesktop, ready } = useEmpPortalLayout();
  if (!ready) {
    return <WorkspaceFallback />;
  }
  if (isDesktop) {
    return <Suspense fallback={<WorkspaceFallback />}>{workspace}</Suspense>;
  }
  return <>{mobile}</>;
}
