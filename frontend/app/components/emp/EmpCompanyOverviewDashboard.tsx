"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CalendarDays, Megaphone, Bell } from "lucide-react";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { StatCard } from "@/app/dashboard/components/StatCard";
import SoftBarChart from "@/app/dashboard/components/SoftBarChart";
import { groupCountByField } from "@/app/dashboard/components/MetricMicroViz";
import { cardShell, gridGap, sectionGap } from "@/app/dashboard/components/dashboard-ui";
import { authHeaders } from "@/lib/auth";
import { fmtJoined } from "@/app/hooks/useEmpProfile";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type MemoItem = {
  id?: number;
  title?: string;
  subject?: string;
  memoType?: string;
  createdAt?: string;
};

function memoTitle(m: MemoItem) {
  return m.subject || m.title || "Notice";
}

export function EmpCompanyOverviewDashboard() {
  const user = useCurrentUser();
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [holidays, setHolidays] = useState<{ name: string; date: string }[]>([]);
  const [noticeboard, setNoticeboard] = useState<MemoItem[]>([]);
  const [messaging, setMessaging] = useState<MemoItem[]>([]);
  const [publicHolidayCount, setPublicHolidayCount] = useState(0);
  const [departments, setDepartments] = useState<{ departmentName: string; employeeCount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const username = user?.username;
        let empId = user?.employee?.id;

        if (username) {
          const credRes = await fetch(
            `${BACKEND}/manage-emp/credentials/${encodeURIComponent(username)}`,
            { headers: authHeaders() },
          );
          if (credRes.ok) {
            const creds = await credRes.json();
            empId = creds?.employee?.id ?? empId;
          }
        }

        const tasks: Promise<void>[] = [];

        if (empId) {
          tasks.push(
            fetch(`${BACKEND}/emp-manager-scope/team-today-status?scope=team`, {
              headers: authHeaders(),
            })
              .then((r) => (r.ok ? r.json() : { members: [] }))
              .then((data) => {
                if (cancelled) return;
                const count = Array.isArray(data.members) ? data.members.length + 1 : 1;
                setEmployeeCount(count);
              }),
          );

          tasks.push(
            fetch(`${BACKEND}/employee-memo`, { headers: authHeaders() })
              .then((r) => (r.ok ? r.json() : []))
              .then((data) => {
                if (cancelled || !Array.isArray(data)) return;
                const mine = data.filter(
                  (m: { employeeID?: number; employeeIDs?: number[]; undoneAt?: string | null }) =>
                    !m.undoneAt &&
                    (m.employeeID === empId ||
                      (Array.isArray(m.employeeIDs) && m.employeeIDs.includes(empId))),
                );
                mine.sort(
                  (a: MemoItem, b: MemoItem) =>
                    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
                );
                setNoticeboard(
                  mine.filter((m: MemoItem) =>
                    ["Warning", "Policy", "Appreciation"].includes(m.memoType || ""),
                  ).slice(0, 5),
                );
                setMessaging(
                  mine.filter((m: MemoItem) => (m.memoType || "General") === "General").slice(0, 5),
                );
              }),
          );
        }

        tasks.push(
          fetch(`${BACKEND}/emp-notifications/holidays`, { headers: authHeaders() })
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => {
              if (cancelled) return;
              const list = Array.isArray(data) ? data : data?.holidays ?? [];
              setHolidays(
                list.slice(0, 5).map((h: { holidayName?: string; name?: string; date?: string; holidayDate?: string }) => ({
                  name: h.holidayName || h.name || "Holiday",
                  date: h.date || h.holidayDate || "",
                })),
              );
            }),
        );

        tasks.push(
          fetch(`${BACKEND}/public-holiday`, { headers: authHeaders() })
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => {
              if (cancelled) return;
              setPublicHolidayCount(Array.isArray(data) ? data.length : 0);
            }),
        );

        tasks.push(
          fetch(`${BACKEND}/emp-manager-scope/company-departments`, { headers: authHeaders() })
            .then((r) => (r.ok ? r.json() : { departments: [] }))
            .then((data) => {
              if (cancelled) return;
              const list = Array.isArray(data?.departments) ? data.departments : [];
              setDepartments(
                list.map((d: { departmentName?: string; employeeCount?: number }) => ({
                  departmentName: d.departmentName || "Department",
                  employeeCount: d.employeeCount ?? 0,
                })),
              );
            }),
        );

        await Promise.all(tasks);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.username, user?.employee?.id]);

  const holidayChartData = useMemo(
    () =>
      holidays.slice(0, 6).map((h) => ({
        day: h.name.length > 10 ? `${h.name.slice(0, 10)}…` : h.name,
        value: 1,
      })),
    [holidays],
  );

  const deptBars = useMemo(
    () =>
      departments
        .filter((d) => d.employeeCount > 0)
        .slice(0, 5)
        .map((d) => ({ label: d.departmentName, value: d.employeeCount })),
    [departments],
  );

  const holidayStrip = useMemo(
    () =>
      holidays.slice(0, 4).map((h) => ({
        label: h.name.length > 8 ? `${h.name.slice(0, 8)}…` : h.name,
        date: h.date ? fmtJoined(h.date).split(",")[0] : undefined,
      })),
    [holidays],
  );

  const noticeTimeline = useMemo(
    () =>
      noticeboard.slice(0, 3).map((m) => ({
        label: memoTitle(m),
        sub: m.memoType || "Notice",
      })),
    [noticeboard],
  );

  const messageSegments = useMemo(() => {
    const recent = messaging.filter((m) => {
      if (!m.createdAt) return false;
      const days = (Date.now() - new Date(m.createdAt).getTime()) / 86400000;
      return days <= 7;
    }).length;
    return [
      { label: "Recent", value: recent, color: "#2563eb" },
      { label: "Older", value: Math.max(0, messaging.length - recent), color: "#94a3b8" },
    ];
  }, [messaging]);

  return (
    <EmpDesktopPage title="Company Overview" icon={Building2}>
      <div className={sectionGap}>
        {loading ? (
          <div className={`grid sm:grid-cols-2 lg:grid-cols-4 ${gridGap} animate-pulse`}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${cardShell} h-[190px]`} />
            ))}
          </div>
        ) : (
          <>
            <div className={`grid sm:grid-cols-2 lg:grid-cols-4 ${gridGap}`}>
              <StatCard
                stat={{
                  label: "Department size",
                  value: employeeCount ?? 0,
                  unit: employeeCount != null ? `${employeeCount} employees` : "Loading…",
                  icon: Building2,
                  href: "/empCompany/departments",
                  visualization: { type: "bars", items: deptBars },
                  accentColor: "#2563eb",
                }}
              />
              <StatCard
                stat={{
                  label: "Upcoming holidays",
                  value: holidays.length,
                  unit: "On the company calendar",
                  icon: CalendarDays,
                  href: "/empHolidays",
                  visualization: { type: "calendar", items: holidayStrip },
                  accentColor: "#14b8a6",
                }}
              />
              <StatCard
                stat={{
                  label: "Noticeboard",
                  value: noticeboard.length,
                  unit: "Policy & announcements",
                  icon: Bell,
                  href: "/empProfile?tab=messaging",
                  visualization: { type: "timeline", items: noticeTimeline },
                  accentColor: "#7c3aed",
                }}
              />
              <StatCard
                stat={{
                  label: "Internal messages",
                  value: messaging.length,
                  unit: "Team communications",
                  icon: Megaphone,
                  href: "/empProfile?tab=messaging",
                  visualization: { type: "stacked", segments: messageSegments },
                  accentColor: "#f59e0b",
                }}
              />
            </div>

            <section className={`${cardShell} p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-base font-semibold">Upcoming holidays</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Next company holidays on the calendar</p>
                </div>
                <Link href="/empHolidays" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>
              {holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming company holidays configured.</p>
              ) : (
                <>
                  <SoftBarChart
                    data={holidayChartData}
                    highlightColor="#2563eb"
                    barColor="#dbeafe"
                    className="h-[180px]"
                  />
                  <ul className="divide-y divide-border mt-4">
                    {holidays.map((h, i) => (
                      <li key={`${h.name}-${i}`} className="flex items-center justify-between py-3 first:pt-0">
                        <span className="text-sm font-medium text-foreground">{h.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {h.date ? fmtJoined(h.date) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <div className={`grid lg:grid-cols-2 ${gridGap}`}>
              <section className={`${cardShell} p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-base font-semibold">Noticeboard</h3>
                  <Link href="/empProfile?tab=messaging" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
                {noticeboard.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notices or policy updates yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {noticeboard.map((m, i) => (
                      <li key={m.id ?? i} className="py-3 first:pt-0">
                        <p className="text-sm font-medium text-foreground truncate">{memoTitle(m)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.memoType || "Notice"}
                          {m.createdAt ? ` · ${fmtJoined(m.createdAt)}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={`${cardShell} p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-base font-semibold">Internal messaging</h3>
                  <Link href="/empProfile?tab=messaging" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
                {messaging.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No internal messages yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {messaging.map((m, i) => (
                      <li key={m.id ?? i} className="py-3 first:pt-0">
                        <p className="text-sm font-medium text-foreground truncate">{memoTitle(m)}</p>
                        {m.createdAt ? (
                          <p className="text-xs text-muted-foreground mt-0.5">{fmtJoined(m.createdAt)}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={`${cardShell} p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-base font-semibold">Public holidays</h3>
                  <Link href="/empPublicHoliday" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  {publicHolidayCount > 0
                    ? `${publicHolidayCount} public holiday${publicHolidayCount === 1 ? "" : "s"} configured for your company.`
                    : "No public holidays configured yet."}
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </EmpDesktopPage>
  );
}
