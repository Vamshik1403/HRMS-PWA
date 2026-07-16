"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { EmpReimbursementMobile } from "../EmpReimbursementMobile";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";
import { EmpDesktopPage } from "../desktop/EmpDesktopPage";
import { DashboardSection } from "../../../dashboard/components/dashboard-ui";
import { Button } from "../../ui/button";

export function EmpReimbursementWorkspace() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  if (tab === "apply") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Apply for reimbursement" description="Submit expense claims for approval" icon={Wallet}>
          <DashboardSection className="max-w-2xl">
            <p className="text-sm text-muted-foreground mb-6">
              Attach receipts and categorize your expenses. Claims route to your manager for review.
            </p>
            <Button asChild size="lg">
              <Link href="/empReimbursement/new">
                <Plus className="w-4 h-4" />
                Open reimbursement form
              </Link>
            </Button>
          </DashboardSection>
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  return (
    <EmpWorkspaceContent>
      <EmpReimbursementMobile desktopTab={tab} />
    </EmpWorkspaceContent>
  );
}
