"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { listCardClass } from "../../app/list-ui-styles";
import { useEmpManagerScope } from "../../../hooks/useEmpManagerScope";
import { reporteeDisplayName, teamReportees } from "../../../utils/empManagerDisplay";
import { formatPunchTime } from "../../../utils/empAttendanceHistory";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type TeamScope = "team" | "reportees";

type MemberToday = {
  id: number;
  employeeID?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  isCheckedIn?: boolean;
  checkInTime?: string | null;
  statusLabel?: string;
};

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function statusTone(label: string) {
  if (label === "Checked in") return "text-emerald-600";
  if (label === "Checked out") return "text-blue-600";
  if (label === "Absent") return "text-rose-600";
  return "text-amber-600";
}

function memberName(m: MemberToday) {
  return reporteeDisplayName(m);
}

function fallbackReportees(scope: ReturnType<typeof useEmpManagerScope>["scope"]): MemberToday[] {
  return teamReportees(scope).map((r) => ({
    id: r.id,
    employeeID: r.employeeID,
    employeeFirstName: r.employeeFirstName,
    employeeLastName: r.employeeLastName,
    statusLabel: "Yet to check-in",
  }));
}

const SCOPE_TABS: { id: TeamScope; label: string; icon: typeof Users }[] = [
  { id: "reportees", label: "My reportees", icon: Users },
  { id: "team", label: "My team", icon: Building2 },
];

export function EmpDesktopTeamReportees() {
  const { scope: managerScope, loading: scopeLoading, isManagerView } = useEmpManagerScope();
  const [scope, setScope] = useState<TeamScope>("reportees");
  const [members, setMembers] = useState<MemberToday[]>([]);
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const reporteeCount = useMemo(() => teamReportees(managerScope).length, [managerScope]);

  useEffect(() => {
    if (scopeLoading) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (scope === "reportees") {
          const res = await fetch(`${BACKEND}/emp-manager-scope/reportees-today-status`, {
            headers: authHeaders(),
            cache: "no-store",
          });
          if (cancelled) return;

          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data.reportees) ? data.reportees : [];
            if (list.length > 0) {
              setMembers(list);
              return;
            }
          }

          setMembers(fallbackReportees(managerScope));
          return;
        }

        const res = await fetch(`${BACKEND}/emp-manager-scope/team-today-status?scope=team`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.members) ? data.members : [];
          setMembers(list);
          setTeamCount(list.length);
        } else {
          setMembers([]);
        }
      } catch {
        if (!cancelled) {
          if (scope === "reportees") {
            setMembers(fallbackReportees(managerScope));
          } else {
            setMembers([]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [scope, scopeLoading, managerScope]);

  if (!isManagerView) return null;

  const countFor = (tab: TeamScope) => (tab === "reportees" ? reporteeCount : teamCount);

  return (
    <Card className={cn(listCardClass, "h-full flex flex-col min-h-[420px]")}>
      <CardHeader className="shrink-0 space-y-4 pb-3">
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Team notifications
          </CardTitle>
          <CardDescription className="mt-1">
            {scope === "team"
              ? "My team — today's attendance"
              : "Direct reportees — today's attendance"}
          </CardDescription>
        </div>

        <div
          className="inline-flex w-full rounded-lg border border-border/80 bg-muted/30 p-1"
          role="tablist"
          aria-label="Team scope"
        >
          {SCOPE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = scope === tab.id;
            const count = countFor(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScope(tab.id)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-all",
                  active
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "opacity-70")} />
                <span className="truncate">{tab.label}</span>
                {count != null && count > 0 ? (
                  <span
                    className={cn(
                      "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      active ? "bg-primary/10 text-primary" : "bg-background/80 text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0">
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading team…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {scope === "team" ? "No team members found." : "No reportees linked yet."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const name = memberName(m);
              const initials =
                name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0].toUpperCase())
                  .join("") || "?";
              const statusLabel = m.statusLabel || "Yet to check-in";
              const checkInLabel =
                m.checkInTime && (m.isCheckedIn || m.statusLabel === "Checked out")
                  ? formatPunchTime(m.checkInTime)
                  : null;

              return (
                <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{name}</p>
                    {m.employeeID ? (
                      <p className="text-[11px] text-muted-foreground truncate">ID: {m.employeeID}</p>
                    ) : null}
                    <p className={cn("text-xs font-semibold mt-0.5", statusTone(statusLabel))}>
                      {statusLabel}
                      {checkInLabel ? ` · ${checkInLabel}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
