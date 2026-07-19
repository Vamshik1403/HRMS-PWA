"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { CalendarCheck, ClipboardList, Users, UserCheck } from "lucide-react";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { teamReportees } from "@/app/utils/empManagerDisplay";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { EmpTeamPulsePanel } from "./desktop/EmpTeamPulsePanel";
import { EmpTeamWeeklyAttendancePanel } from "./desktop/EmpTeamWeeklyAttendancePanel";
import { StatCard } from "@/app/dashboard/components/StatCard";
import { groupCountByField } from "@/app/dashboard/components/MetricMicroViz";
import { cardShell, gridGap, sectionGap } from "@/app/dashboard/components/dashboard-ui";
import { authHeaders } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type HrWidgets = {
  pendingCounts?: { leave?: number; reimbursement?: number; im?: number; tasks?: number };
  latestTasks?: { id: number; status: string }[];
  upcomingEvents?: { id: string; kind: string; label: string; when: string }[];
  newsFeed?: { id: string; title: string; subtitle: string; date: string }[];
};

export function EmpTeamOverview() {
  const user = useCurrentUser();
  const { isManagerView, loading: scopeLoading, scope } = useEmpManagerScope();
  const [teamMembers, setTeamMembers] = useState<
    { id: number; statusLabel?: string; designation?: string | null; employeeFirstName?: string | null; employeeLastName?: string | null }[]
  >([]);
  const [reportees, setReportees] = useState<
    { id: number; designation?: string | null; employeeFirstName?: string | null; employeeLastName?: string | null }[]
  >([]);
  const [apiReporteeCount, setApiReporteeCount] = useState<number | null>(null);
  const [hrWidgets, setHrWidgets] = useState<HrWidgets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isManagerView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const companyId = user?.companyID;
    const qs = companyId ? `?companyID=${companyId}` : "";

    Promise.all([
      fetch(`${BACKEND}/emp-manager-scope/team-today-status?scope=team`, {
        headers: authHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { members: [] })),
      fetch(`${BACKEND}/emp-manager-scope/reportees-today-status`, {
        headers: authHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : { reportees: [] })),
      fetch(`${BACKEND}/dashboard-overview/hr-widgets${qs}`, {
        headers: authHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([teamData, reporteesData, widgets]) => {
        if (cancelled) return;
        setTeamMembers(Array.isArray(teamData.members) ? teamData.members : []);
        const reporteeList = Array.isArray(reporteesData.reportees) ? reporteesData.reportees : [];
        setReportees(reporteeList);
        setApiReporteeCount(reporteeList.length);
        setHrWidgets(widgets);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isManagerView, user?.companyID]);

  const reporteeCount = apiReporteeCount ?? teamReportees(scope).length;

  const pendingTotal = useMemo(() => {
    const p = hrWidgets?.pendingCounts;
    return (p?.leave ?? 0) + (p?.reimbursement ?? 0);
  }, [hrWidgets]);
  const pendingTasks = hrWidgets?.pendingCounts?.tasks ?? 0;
  const upcomingBirthdays = useMemo(
    () => hrWidgets?.upcomingEvents?.filter((e) => e.kind === "birthday") ?? [],
    [hrWidgets],
  );
  const upcomingAnniversaries = useMemo(
    () => hrWidgets?.upcomingEvents?.filter((e) => e.kind === "anniversary") ?? [],
    [hrWidgets],
  );

  const reporteeDeptBars = useMemo(
    () => groupCountByField(reportees, (r) => r.designation || "Team"),
    [reportees],
  );

  const teamStatusSegments = useMemo(() => {
    const present = teamMembers.filter((m) => m.statusLabel === "Checked in").length;
    const checkedOut = teamMembers.filter((m) => m.statusLabel === "Checked out").length;
    const absent = teamMembers.filter((m) => m.statusLabel === "Absent").length;
    const pending = Math.max(0, teamMembers.length - present - checkedOut - absent);
    return [
      { label: "Present", value: present, color: "#22c55e" },
      { label: "Pending", value: pending, color: "#f59e0b" },
      { label: "Away", value: checkedOut + absent, color: "#f43f5e" },
    ];
  }, [teamMembers]);

  const approvalSegments = useMemo(() => {
    const p = hrWidgets?.pendingCounts;
    return [
      { label: "Leave", value: p?.leave ?? 0, color: "#2563eb" },
      { label: "Expense", value: p?.reimbursement ?? 0, color: "#7c3aed" },
      { label: "IM", value: p?.im ?? 0, color: "#14b8a6" },
    ];
  }, [hrWidgets]);

  const taskSegments = useMemo(() => {
    const tasks = hrWidgets?.latestTasks ?? [];
    const open = tasks.filter((t) => /open|todo|new/i.test(t.status)).length;
    const progress = tasks.filter((t) => /progress|active/i.test(t.status)).length;
    const done = tasks.filter((t) => /complete|done|closed/i.test(t.status)).length;
    const pending = pendingTasks;
    if (tasks.length > 0) {
      return [
        { label: "Open", value: open || pending, color: "#f59e0b" },
        { label: "In progress", value: progress, color: "#2563eb" },
        { label: "Done", value: done, color: "#22c55e" },
      ];
    }
    return [
      { label: "Pending", value: pending, color: "#f59e0b" },
      { label: "Active", value: 0, color: "#2563eb" },
      { label: "Done", value: 0, color: "#22c55e" },
    ];
  }, [hrWidgets, pendingTasks]);

  const reporteeAvatars = useMemo(
    () =>
      reportees.slice(0, 5).map((r) => ({
        initial:
          (r.employeeFirstName?.[0] || r.employeeLastName?.[0] || "?").toUpperCase(),
      })),
    [reportees],
  );

  if (scopeLoading || loading) {
    return (
      <EmpDesktopPage title="Team Overview" description="Team updates, attendance, and celebrations" icon={Users}>
        <div className={`grid sm:grid-cols-2 lg:grid-cols-4 ${gridGap} animate-pulse`}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${cardShell} h-[190px]`} />
          ))}
        </div>
      </EmpDesktopPage>
    );
  }

  if (!isManagerView) {
    return (
      <EmpDesktopPage title="Team Overview" description="Team updates, attendance, and celebrations" icon={Users}>
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          You do not have team management access.
        </div>
      </EmpDesktopPage>
    );
  }

  return (
    <EmpDesktopPage title="Team Overview" description="Team updates, attendance, and celebrations" icon={Users}>
      <div className={sectionGap}>
        <div className={`grid sm:grid-cols-2 lg:grid-cols-4 ${gridGap}`}>
          <StatCard
            stat={{
              label: "My reportees",
              value: reporteeCount,
              unit: `${reporteeCount} direct report${reporteeCount === 1 ? "" : "s"}`,
              icon: UserCheck,
              href: "/empTeam/my-team?scope=reportees",
              visualization:
                reporteeAvatars.length > 0
                  ? { type: "avatar-stack", avatars: reporteeAvatars }
                  : { type: "bars", items: reporteeDeptBars },
              accentColor: "#2563eb",
            }}
          />
          <StatCard
            stat={{
              label: "My team members",
              value: teamMembers.length,
              unit: `${teamMembers.length} in your department`,
              icon: Users,
              href: "/empTeam/my-team?scope=team",
              visualization: { type: "stacked", segments: teamStatusSegments },
              accentColor: "#7c3aed",
            }}
          />
          <StatCard
            stat={{
              label: "Pending approvals",
              value: pendingTotal,
              unit: "Awaiting your review",
              icon: CalendarCheck,
              href: "/empTeam/approvals",
              trendDelta: pendingTotal > 0 ? `▲ ${pendingTotal} open` : undefined,
              visualization: { type: "progress", segments: approvalSegments },
              iconClassName: "bg-amber-500/10 text-amber-600",
              accentColor: "#f59e0b",
            }}
          />
          <StatCard
            stat={{
              label: "Pending tasks",
              value: pendingTasks,
              unit: "Assigned to your team",
              icon: ClipboardList,
              href: "/empMyTasks",
              visualization: { type: "donut", segments: taskSegments },
              accentColor: "#14b8a6",
            }}
          />
        </div>

        <EmpTeamWeeklyAttendancePanel />

        <div className={`grid lg:grid-cols-2 ${gridGap} items-start`}>
          <EmpTeamPulsePanel />

          <div className="space-y-6">
            <section className={`${cardShell} p-6`}>
              <h3 className="font-display text-base font-semibold text-foreground mb-4">
                Upcoming birthdays &amp; anniversaries
              </h3>
              {upcomingBirthdays.length === 0 && upcomingAnniversaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming celebrations this month.</p>
              ) : (
                <ul className="space-y-3">
                  {[...upcomingBirthdays, ...upcomingAnniversaries].slice(0, 8).map((ev) => (
                    <li key={ev.id} className="flex items-center gap-3">
                      <span className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon
                          icon={ev.kind === "birthday" ? "mdi:cake-variant" : "mdi:medal"}
                          className="size-5 text-primary"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ev.label}</p>
                        <p className="text-xs text-muted-foreground">{ev.when}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`${cardShell} p-6`}>
              <h3 className="font-display text-base font-semibold text-foreground mb-4">Team news</h3>
              {hrWidgets?.newsFeed?.length ? (
                <ul className="space-y-3">
                  {hrWidgets.newsFeed.slice(0, 5).map((item) => (
                    <li key={item.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No recent team updates.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </EmpDesktopPage>
  );
}
