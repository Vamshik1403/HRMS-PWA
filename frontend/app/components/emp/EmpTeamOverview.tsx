"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Cake, CalendarCheck, Users, UserCheck } from "lucide-react";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { EmpTeamPulsePanel } from "./desktop/EmpTeamPulsePanel";
import { StatCard } from "@/app/dashboard/components/StatCard";
import { cardShell, gridGap, sectionGap } from "@/app/dashboard/components/dashboard-ui";
import { authHeaders } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type HrWidgets = {
  pendingCounts?: { leave?: number; reimbursement?: number; im?: number; tasks?: number };
  upcomingEvents?: { id: string; kind: string; label: string; when: string }[];
  newsFeed?: { id: string; title: string; subtitle: string; date: string }[];
};

export function EmpTeamOverview() {
  const user = useCurrentUser();
  const { isManagerView, loading: scopeLoading } = useEmpManagerScope();
  const [teamMembers, setTeamMembers] = useState<
    { id: number; statusLabel?: string }[]
  >([]);
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
      fetch(`${BACKEND}/dashboard-overview/hr-widgets${qs}`, {
        headers: authHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([teamData, widgets]) => {
        if (cancelled) return;
        setTeamMembers(Array.isArray(teamData.members) ? teamData.members : []);
        setHrWidgets(widgets);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isManagerView, user?.companyID]);

  const presentCount = useMemo(
    () => teamMembers.filter((m) => m.statusLabel === "Checked in").length,
    [teamMembers],
  );
  const pendingTotal = useMemo(() => {
    const p = hrWidgets?.pendingCounts;
    return (p?.leave ?? 0) + (p?.reimbursement ?? 0);
  }, [hrWidgets]);
  const upcomingBirthdays = useMemo(
    () => hrWidgets?.upcomingEvents?.filter((e) => e.kind === "birthday") ?? [],
    [hrWidgets],
  );
  const upcomingAnniversaries = useMemo(
    () => hrWidgets?.upcomingEvents?.filter((e) => e.kind === "anniversary") ?? [],
    [hrWidgets],
  );

  if (scopeLoading || loading) {
    return (
      <EmpDesktopPage title="Team Overview" description="Team updates, attendance, and celebrations" icon={Users}>
        <div className={`grid sm:grid-cols-2 lg:grid-cols-4 ${gridGap} animate-pulse`}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${cardShell} h-24`} />
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
          <StatCard stat={{ label: "Team members", value: String(teamMembers.length), icon: Users }} />
          <StatCard stat={{ label: "Present today", value: String(presentCount), icon: UserCheck }} />
          <StatCard stat={{ label: "Pending approvals", value: String(pendingTotal), icon: CalendarCheck }} />
          <StatCard stat={{ label: "Birthdays soon", value: String(upcomingBirthdays.length), icon: Cake }} />
        </div>

        <div className={`grid lg:grid-cols-2 ${gridGap}`}>
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
