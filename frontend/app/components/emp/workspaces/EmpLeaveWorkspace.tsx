"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Calendar, FileText, Plus } from "lucide-react";
import { EmpLeaveMobile } from "../EmpLeaveMobile";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";
import { EmpDesktopPage } from "../desktop/EmpDesktopPage";
import { DashboardSection } from "../../../dashboard/components/dashboard-ui";
import { Button } from "../../ui/button";

export function EmpLeaveWorkspace() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  if (tab === "apply") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Apply for leave" description="Submit a new leave request for manager approval" icon={FileText}>
          <DashboardSection className="max-w-2xl">
            <p className="text-sm text-muted-foreground mb-6">
              Complete the leave application form with dates, type, and reason. Your manager will be notified for approval.
            </p>
            <Button asChild size="lg">
              <Link href="/empLeaveApplication/new">
                <Plus className="w-4 h-4" />
                Open leave application form
              </Link>
            </Button>
          </DashboardSection>
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  if (tab === "holidays") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Holiday calendar" description="Company and public holidays" icon={Calendar}>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href="/empHolidays">Company holidays</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/empPublicHoliday">Public holidays</Link>
            </Button>
          </div>
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  return (
    <EmpWorkspaceContent>
      <EmpLeaveMobile desktopTab={tab} />
    </EmpWorkspaceContent>
  );
}
