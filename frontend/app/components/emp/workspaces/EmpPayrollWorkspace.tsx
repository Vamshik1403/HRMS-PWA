"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Banknote, FileText, Wallet } from "lucide-react";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";
import { EmpPayoutContent } from "../EmpPayoutContent";
import { EmpProfileSalaryAdvancePanel } from "../EmpProfileSalaryAdvancePanel";
import { EmpDesktopPage } from "../desktop/EmpDesktopPage";
import { actionTileClass, gridGap } from "../../../dashboard/components/dashboard-ui";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function useShowLoanAdvances() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("user");
      if (!rawUser) return;
      const user = JSON.parse(rawUser);
      const fromUser = user?.employee?.pwaShowLoanAdvances ?? user?.pwaShowLoanAdvances;
      if (typeof fromUser === "boolean") setShow(fromUser !== false);
      const username = user?.username;
      if (!username) return;
      fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(username)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((creds) => {
          const flag = creds?.employee?.pwaShowLoanAdvances;
          if (typeof flag === "boolean") setShow(flag !== false);
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
  }, []);
  return show;
}

function PayrollOverview({ showLoanAdvances }: { showLoanAdvances: boolean }) {
  const tiles = [
    {
      href: "/empPayout?tab=payslips",
      icon: FileText,
      label: "Payslips",
      desc: "View and download payslips",
    },
    ...(showLoanAdvances
      ? [
          {
            href: "/empPayout?tab=salary-advance",
            icon: Wallet,
            label: "Salary advance",
            desc: "Request or track advances",
          },
        ]
      : []),
  ];

  return (
    <div className={`grid sm:grid-cols-2 ${gridGap} max-w-3xl`}>
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
  const showLoanAdvances = useShowLoanAdvances();

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
    if (!showLoanAdvances) {
      return (
        <EmpWorkspaceContent>
          <EmpDesktopPage title="Payroll overview" description="Payslips" icon={Banknote}>
            <PayrollOverview showLoanAdvances={false} />
          </EmpDesktopPage>
        </EmpWorkspaceContent>
      );
    }
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Salary advance" description="Request or track your salary advances" icon={Wallet}>
          <EmpProfileSalaryAdvancePanel />
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  // Legacy generate deep-link — send users to payroll overview (tools live under More)
  if (tab === "generate") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Payroll overview" description="Payslips and salary advances" icon={Banknote}>
          <PayrollOverview showLoanAdvances={showLoanAdvances} />
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  return (
    <EmpWorkspaceContent>
      <EmpDesktopPage title="Payroll overview" description="Payslips and salary advances" icon={Banknote}>
        <PayrollOverview showLoanAdvances={showLoanAdvances} />
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
