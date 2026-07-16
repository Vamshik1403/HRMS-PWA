"use client";

import { Suspense } from "react";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpDesktopWorkspaceGate } from "../components/emp/EmpDesktopWorkspaceGate";
import { EmpPayrollWorkspace } from "../components/emp/workspaces/EmpPayrollWorkspace";
import { EmpPayoutContent } from "../components/emp/EmpPayoutContent";

export default function EmpPayoutPage() {
  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate
        workspace={<EmpPayrollWorkspace />}
        mobile={
          <Suspense
            fallback={
              <div className="px-4 pt-6 pb-8 flex justify-center py-16">
                <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            }
          >
            <EmpPayoutContent />
          </Suspense>
        }
      />
    </EmpMobileLayout>
  );
}
