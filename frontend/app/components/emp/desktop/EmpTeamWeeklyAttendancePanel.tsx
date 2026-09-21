"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Users } from "lucide-react";
import SoftBarChart from "@/app/dashboard/components/SoftBarChart";
import { cardShell } from "@/app/dashboard/components/dashboard-ui";
import { cn } from "@/app/utils/cn";
import { todayPunchDateKey } from "@/app/utils/attendanceDuration";
import { authHeaders } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type TeamMember = { id: number; statusLabel?: string };

function buildLast7DayKeys() {
  const keys: string[] = [];
  const base = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    keys.push(todayPunchDateKey(d));
  }
  return keys;
}

function isPresentStatus(label?: string) {
  return label === "Checked in" || label === "Checked out";
}

export function EmpTeamWeeklyAttendancePanel() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [presentByDay, setPresentByDay] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const teamRes = await fetch(`${BACKEND}/emp-manager-scope/team-today-status?scope=team`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const teamData = teamRes.ok ? await teamRes.json() : { members: [] };
      const teamMembers: TeamMember[] = Array.isArray(teamData.members) ? teamData.members : [];
      setMembers(teamMembers);

      if (teamMembers.length === 0) {
        setPresentByDay({});
        return;
      }

      const dayKeys = buildLast7DayKeys();
      const results = await Promise.all(
        teamMembers.map(async (m) => {
          const res = await fetch(
            `${BACKEND}/emp-manager-scope/member/${m.id}/attendance-history?from=${dayKeys[0]}&to=${dayKeys[dayKeys.length - 1]}`,
            { headers: authHeaders(), cache: "no-store" },
          );
          if (!res.ok) return { memberId: m.id, days: [] as { date?: string; inTime?: string; outTime?: string; status?: string }[] };
          const data = await res.json();
          return {
            memberId: m.id,
            days: Array.isArray(data?.days) ? data.days : [],
          };
        }),
      );

      const counts: Record<string, number> = {};
      for (const { days } of results) {
        for (const day of days) {
          const key = day.date?.slice(0, 10);
          if (!key) continue;
          if (day.inTime || day.outTime || day.status === "Present") {
            counts[key] = (counts[key] || 0) + 1;
          }
        }
      }

      const todayKey = todayPunchDateKey();
      const liveToday = teamMembers.filter((m) => isPresentStatus(m.statusLabel)).length;
      if (liveToday > 0) {
        counts[todayKey] = Math.max(counts[todayKey] || 0, liveToday);
      }

      setPresentByDay(counts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const dayKeys = useMemo(() => buildLast7DayKeys(), []);

  const chartData = useMemo(
    () =>
      dayKeys.map((key) => ({
        day: new Date(`${key}T12:00:00Z`).toLocaleDateString("en-IN", {
          weekday: "short",
          timeZone: "UTC",
        }),
        value: presentByDay[key] || 0,
      })),
    [dayKeys, presentByDay],
  );

  const presentToday = members.filter((m) => m.statusLabel === "Checked in").length;
  const totalMemberDays = dayKeys.reduce((sum, key) => sum + (presentByDay[key] || 0), 0);

  return (
    <section className={cn(cardShell, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">Weekly attendance</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Team members present over the last 7 days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5 mr-1 text-primary" />
            {presentToday} present today
          </span>
          <span className="inline-flex items-center rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="size-3.5 mr-1 text-primary" />
            {totalMemberDays} member-days
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-[160px] animate-pulse rounded-xl bg-muted/50" />
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No team members who report to your reportees yet.
        </p>
      ) : (
        <SoftBarChart
          data={chartData}
          highlightColor="#2563eb"
          barColor="#dbeafe"
          className="h-[160px]"
          valueLabel="Members"
        />
      )}

      <div className="mt-2 flex justify-end">
        <Link href="/empTeam/my-team" className="text-xs font-medium text-primary hover:underline">
          View team
        </Link>
      </div>
    </section>
  );
}
