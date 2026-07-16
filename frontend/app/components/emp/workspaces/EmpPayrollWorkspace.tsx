"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Banknote, Calculator, FileText, Wallet } from "lucide-react";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";
import { EmpPayoutContent } from "../EmpPayoutContent";
import { EmpDesktopPage } from "../desktop/EmpDesktopPage";
import { DashboardSection, actionTileClass, gridGap } from "../../../dashboard/components/dashboard-ui";
import { Button } from "../../ui/button";

function PayrollOverview() {
  const tiles = [
    {
      href: "/empPayout?tab=payslips",
      icon: FileText,
      label: "Payslips",
      desc: "View and download payslips",
    },
    {
      href: "/empPayout?tab=salary-advance",
      icon: Wallet,
      label: "Salary advance",
      desc: "Request or track advances",
    },
    {
      href: "/empPayout?tab=generate",
      icon: Calculator,
      label: "Generate salary",
      desc: "Salary generation tools",
    },
  ];

  return (
    <div className={`grid sm:grid-cols-3 ${gridGap}`}>
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <Link key={t.href} href={t.href} className={actionTileClass}>
            <span className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
              <Icon className="size-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function PayrollWorkspaceInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  if (tab === "payslips") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Payslips" description="View and download your payslips by period" icon={FileText}>
          <EmpPayoutContent embedded />
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  if (tab === "salary-advance") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Salary advance" description="Manage salary advance requests" icon={Wallet}>
          <DashboardSection className="max-w-lg">
            <Button asChild>
              <Link href="/empSalaryAdvance">Open salary advance</Link>
            </Button>
          </DashboardSection>
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  if (tab === "generate") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Generate salary" description="Salary generation tools" icon={Calculator}>
          <DashboardSection className="max-w-lg">
            <Button asChild>
              <Link href="/empGenerateSalary">Open generate salary</Link>
            </Button>
          </DashboardSection>
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  return (
    <EmpWorkspaceContent>
      <EmpDesktopPage title="Payroll overview" description="Payslips, advances, and salary tools" icon={Banknote}>
        <PayrollOverview />
      </EmpDesktopPage>
    </EmpWorkspaceContent>
  );
}

export function EmpPayrollWorkspace() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading payroll…</div>}>
      <PayrollWorkspaceInner />
    </Suspense>
  );
}
