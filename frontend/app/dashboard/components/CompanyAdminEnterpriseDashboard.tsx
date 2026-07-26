"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Briefcase,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  LineChart,
  Target,
  UserPlus,
  Users,
  UserCheck,
  UserX,
  Wallet,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import type { SoftBarPoint } from "./SoftBarChart";
import type { StatusBreakdownItem } from "./EmployeeStatusCharts";
import type { ActivityItem } from "./ActivityFeed";

const PRIMARY = "#3B82F6";
const BLUE = "#3B82F6";
const GREEN = "#22C55E";
const ORANGE = "#F59E0B";
const RED = "#EF4444";
/** Theme-aware tokens for charts / inline styles */
const TEXT = "hsl(var(--foreground))";
const MUTED = "hsl(var(--muted-foreground))";
const BORDER = "hsl(var(--border))";
const BG = "hsl(var(--background))";

const cardClass =
  "rounded-[18px] border border-border bg-card text-card-foreground p-5 shadow-[0_6px_24px_rgba(15,23,42,0.05)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.35)]";
const ROW_CARD =
  "flex h-full min-h-[300px] max-h-[300px] flex-col overflow-hidden";

export type EnterpriseUpcomingEvent = {
  id: string;
  kind: "birthday" | "anniversary";
  label: string;
  date: string;
  when: string;
};

export type EnterpriseNewsItem = {
  id: string;
  kind: "onboarding" | "holiday";
  title: string;
  subtitle: string;
  date: string;
};

export type EnterprisePendingCounts = {
  im: number;
  tasks: number;
  reimbursement: number;
  leave: number;
  salaryAdvance: number;
};

export type CompanyAdminEnterpriseDashboardProps = {
  firstName?: string;
  todayDate: string;
  overviewTotal: number;
  overviewPresent: number;
  overviewAbsent: number;
  overviewOnLeave: number;
  overviewHalfDay: number;
  overviewStatsReady: boolean;
  employeesCount: number;
  presentTrendVsYesterday: number;
  newJoinersCount: number;
  statusBreakdown: StatusBreakdownItem[];
  attendanceTrend: SoftBarPoint[];
  departmentHeadcounts: { name: string; count: number }[];
  upcomingEvents: EnterpriseUpcomingEvent[];
  newsFeed: EnterpriseNewsItem[];
  activityItems: ActivityItem[];
  pendingCounts: EnterprisePendingCounts | null;
};

function formatWelcomeName(name?: string) {
  const raw = (name || "CompanyAdmin").trim();
  const compact = raw.replace(/\s+/g, "");
  if (/^companyadmin$/i.test(compact)) return "CompanyAdmin";
  if (!compact) return "CompanyAdmin";
  // username-style: companyadmin → CompanyAdmin; john → John
  return compact.charAt(0).toUpperCase() + compact.slice(1);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function buildMonthCells(year: number, month: number) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells: { dateKey: string; day: number; outside: boolean }[] = [];

  for (let i = firstDow - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    cells.push({ dateKey: `${py}-${pad2(pm)}-${pad2(day)}`, day, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateKey: `${year}-${pad2(month)}-${pad2(d)}`, day: d, outside: false });
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    cells.push({ dateKey: `${ny}-${pad2(nm)}-${pad2(d)}`, day: d, outside: true });
  }
  return cells;
}

function DashboardCalendarCard({
  todayDate,
  eventDates,
  schedules,
}: {
  todayDate: string;
  eventDates: Set<string>;
  schedules: { id: string; time: string; title: string; detail: string }[];
}) {
  const initial = useMemo(() => {
    const d = new Date(`${todayDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [todayDate]);

  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth],
  );

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold tracking-tight text-foreground">{monthLabel}</h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mb-0.5 grid grid-cols-7 text-center text-[10px] font-bold text-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 text-center">
        {cells.map((cell) => {
          const dow = new Date(`${cell.dateKey}T12:00:00`).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isToday = cell.dateKey === todayDate;
          const hasEvent = eventDates.has(cell.dateKey);
          return (
            <div key={cell.dateKey} className="flex items-center justify-center py-px">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                  cell.outside && "text-muted-foreground/40",
                  !cell.outside && isWeekend && !isToday && "text-rose-500 dark:text-rose-400",
                  !cell.outside && !isWeekend && !isToday && !hasEvent && "text-foreground",
                  !cell.outside && hasEvent && !isToday && "font-semibold text-primary",
                  isToday && "bg-blue-500 font-bold text-white shadow-sm",
                )}
              >
                {cell.day}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
        <h4 className="text-[13px] font-bold text-foreground">Upcoming Schedules</h4>
        <Link href="/manage-employees" className="text-[11px] font-semibold text-primary">
          See all
        </Link>
      </div>

      <div className="mt-1.5 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {schedules.length === 0 ? (
          <p className="py-3 text-center text-[12px] text-muted-foreground">No upcoming schedules</p>
        ) : (
          schedules.slice(0, 2).map((item) => (
            <div
              key={item.id}
              className="rounded-[10px] border border-border bg-background px-2.5 py-2"
            >
              <p className="text-[10px] text-muted-foreground">{item.time}</p>
              <p className="truncate text-[12px] font-bold text-foreground">{item.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">{item.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function formatStat(ready: boolean, value: number) {
  return ready ? value.toLocaleString() : "—";
}

function Trend({ value }: { value: number }) {
  if (!Number.isFinite(value) || value === 0) {
    return <span className="text-[13px] text-muted-foreground">No change vs yesterday</span>;
  }
  const up = value > 0;
  return (
    <span className={cn("text-[13px] font-medium", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
      {up ? "↑" : "↓"} {Math.abs(value)}% vs yesterday
    </span>
  );
}

function StatIcon({
  children,
  from,
  to,
}: {
  children: ReactNode;
  from: string;
  to: string;
}) {
  return (
    <div
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  title,
  action,
  icon,
}: {
  title: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        <h2 className="truncate text-[16px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function ViewLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-auto inline-flex items-center gap-1 pt-2 text-[13px] font-semibold text-primary transition-colors hover:opacity-80"
    >
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  );
}

function SummaryListRow({
  label,
  value,
  valueColor,
  last,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 border-border py-3", !last && "border-b")}
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span
        className="text-[15px] font-bold tabular-nums text-foreground"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

const QUICK_ACCESS = [
  { href: "/manage-employees", label: "Add Employee", icon: UserPlus, tint: "bg-blue-50 text-blue-600" },
  { href: "/leave-applications", label: "Leave", icon: Calendar, tint: "bg-sky-50 text-sky-600" },
  { href: "/attendance-logs", label: "Attendance", icon: Clock, tint: "bg-emerald-50 text-emerald-600" },
  { href: "/generate-salary", label: "Payroll", icon: Wallet, tint: "bg-blue-50 text-blue-600" },
  { href: "/manage-employees", label: "Recruitment", icon: Briefcase, tint: "bg-amber-50 text-amber-600" },
  { href: "/employee-memo", label: "Documents", icon: FileText, tint: "bg-slate-100 text-slate-600" },
  { href: "/task-projects", label: "Performance", icon: Target, tint: "bg-rose-50 text-rose-600" },
  { href: "/attendance-reports", label: "Reports", icon: LineChart, tint: "bg-blue-50 text-blue-600" },
] as const;

function payrollScheduleLabel(todayDate: string) {
  const d = new Date(`${todayDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Month end";
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CompanyAdminEnterpriseDashboard({
  firstName,
  todayDate,
  overviewTotal,
  overviewPresent,
  overviewAbsent,
  overviewOnLeave,
  overviewHalfDay,
  overviewStatsReady,
  employeesCount,
  presentTrendVsYesterday,
  newJoinersCount,
  statusBreakdown,
  attendanceTrend,
  departmentHeadcounts,
  upcomingEvents,
  newsFeed,
  activityItems,
  pendingCounts,
}: CompanyAdminEnterpriseDashboardProps) {
  const [attPeriod] = useState("This Month");
  const [trendPeriod] = useState("Last 7 Days");

  const displayDate = useMemo(() => {
    const d = new Date(`${todayDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return todayDate;
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [todayDate]);

  const donutData = useMemo(() => {
    const rows = [
      { name: "Present", value: overviewPresent, fill: GREEN },
      { name: "On Leave", value: overviewOnLeave, fill: ORANGE },
      { name: "Absent", value: overviewAbsent, fill: RED },
      { name: "Half Day", value: overviewHalfDay, fill: PRIMARY },
    ].filter((r) => r.value > 0);

    if (rows.length === 0 && overviewStatsReady) {
      return [{ name: "No data", value: 1, fill: "#E2E8F0" }];
    }
    if (rows.length === 0) {
      return statusBreakdown.slice(0, 4).map((s) => ({
        name: s.name,
        value: s.value,
        fill: s.fill,
      }));
    }
    return rows;
  }, [
    overviewPresent,
    overviewOnLeave,
    overviewAbsent,
    overviewHalfDay,
    overviewStatsReady,
    statusBreakdown,
  ]);

  const donutTotal = overviewTotal || donutData.reduce((s, d) => s + d.value, 0);
  const presentPct = pct(overviewPresent, overviewTotal);
  const leavePct = pct(overviewOnLeave, overviewTotal);
  const absentPct = pct(overviewAbsent, overviewTotal);
  const halfPct = pct(overviewHalfDay, overviewTotal);
  const joinersDelta =
    employeesCount > 0 ? Math.round((newJoinersCount / employeesCount) * 1000) / 10 : 0;

  const leavePending = pendingCounts?.leave ?? 0;
  const reimbPending = pendingCounts?.reimbursement ?? 0;
  const advancePending = pendingCounts?.salaryAdvance ?? 0;
  const leaveApproved = overviewOnLeave;
  const leaveRejected = 0;
  const leaveTotal = Math.max(leavePending + leaveApproved + leaveRejected, leavePending + overviewOnLeave);

  const deptChart = useMemo(
    () =>
      departmentHeadcounts
        .filter((d) => d.count > 0)
        .slice(0, 8)
        .map((d) => ({
          name: d.name.length > 12 ? `${d.name.slice(0, 11)}…` : d.name,
          fullName: d.name,
          count: d.count,
        })),
    [departmentHeadcounts],
  );

  const events = useMemo(() => {
    type EventRow = {
      id: string;
      title: string;
      subtitle: string;
      date?: string;
    };
    const items: EventRow[] = [];

    for (const e of upcomingEvents) {
      items.push({
        id: e.id,
        title: e.kind === "birthday" ? "Employee Birthday" : "Work Anniversary",
        subtitle: `${e.label} · ${e.when}`,
        date: e.date,
      });
    }

    for (const n of newsFeed.filter((x) => x.kind === "holiday").slice(0, 3)) {
      if (items.some((i) => i.id === n.id)) continue;
      items.push({
        id: n.id,
        title: n.title || "Company Holiday",
        subtitle: n.subtitle || n.date || "Upcoming",
        date: n.date?.slice(0, 10),
      });
    }

    return items.slice(0, 5);
  }, [upcomingEvents, newsFeed]);

  const eventDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.date) set.add(e.date.slice(0, 10));
    }
    return set;
  }, [events]);

  const schedules = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        time: e.date
          ? new Date(`${e.date.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "Upcoming",
        title: e.title,
        detail: e.subtitle,
      })),
    [events],
  );

  const legend = [
    { name: "Present", value: overviewPresent, percent: presentPct, color: GREEN },
    { name: "On Leave", value: overviewOnLeave, percent: leavePct, color: ORANGE },
    { name: "Absent", value: overviewAbsent, percent: absentPct, color: RED },
    { name: "Half Day", value: overviewHalfDay, percent: halfPct, color: PRIMARY },
  ];

  return (
    <div
      className="ca-enterprise-dashboard -mx-4 -mt-3 -mb-6 min-h-full bg-background px-4 pb-8 pt-0 text-foreground sm:-mx-6 sm:-mt-4 sm:px-6 lg:-mx-8 lg:-mt-5 lg:px-8"
    >
      <style jsx global>{`
        .ca-enterprise-dashboard .ca-fade {
          animation: caFadeUp 0.45s ease-out both;
        }
        @keyframes caFadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Header */}
      <header className="ca-fade mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: TEXT }}>
            Dashboard
          </h1>
          <p className="mt-1 text-[15px]" style={{ color: MUTED }}>
            Welcome back, {formatWelcomeName(firstName)}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            className="inline-flex h-[42px] items-center gap-2 rounded-[14px] border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm"
          >
            <CalendarDays className="size-4" style={{ color: PRIMARY }} />
            <span>Today</span>
            <span style={{ color: MUTED }}>·</span>
            <span style={{ color: MUTED }}>{displayDate}</span>
          </div>
          <Link
            href="/attendance-reports"
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:opacity-95 active:opacity-90"
            style={{ background: PRIMARY }}
          >
            <Download className="size-4" />
            Generate Report
          </Link>
        </div>
      </header>

      {/* Stat cards */}
      <section
        className="ca-fade mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
        style={{ animationDelay: "40ms" }}
      >
        <article className={cn(cardClass, "flex h-[120px] flex-col justify-between")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium" style={{ color: MUTED }}>
                Total Employees
              </p>
              <p className="mt-1 text-[30px] font-bold leading-none tracking-tight">
                {formatStat(overviewStatsReady || employeesCount > 0, overviewTotal || employeesCount)}
              </p>
            </div>
            <StatIcon from="#3B82F6" to="#2563EB">
              <Users className="size-5" />
            </StatIcon>
          </div>
          <p className="text-[12px] font-medium text-emerald-600">
            {newJoinersCount > 0 ? `+${newJoinersCount} this month` : "Active workforce"}
          </p>
        </article>

        <article className={cn(cardClass, "flex h-[120px] flex-col justify-between")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium" style={{ color: MUTED }}>
                Present Today
              </p>
              <p className="mt-1 text-[30px] font-bold leading-none tracking-tight">
                {formatStat(overviewStatsReady, overviewPresent)}
              </p>
            </div>
            <StatIcon from="#22C55E" to="#16A34A">
              <UserCheck className="size-5" />
            </StatIcon>
          </div>
          <p className="text-[12px]" style={{ color: MUTED }}>
            {overviewStatsReady ? `${presentPct}% of total` : "—"}
          </p>
        </article>

        <article className={cn(cardClass, "flex h-[120px] flex-col justify-between")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium" style={{ color: MUTED }}>
                On Leave Today
              </p>
              <p className="mt-1 text-[30px] font-bold leading-none tracking-tight">
                {formatStat(overviewStatsReady, overviewOnLeave)}
              </p>
            </div>
            <StatIcon from="#F59E0B" to="#D97706">
              <CalendarClock className="size-5" />
            </StatIcon>
          </div>
          <p className="text-[12px]" style={{ color: MUTED }}>
            {overviewStatsReady ? `${leavePct}% of total` : "—"}
          </p>
        </article>

        <article className={cn(cardClass, "flex h-[120px] flex-col justify-between")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium" style={{ color: MUTED }}>
                Absent Today
              </p>
              <p className="mt-1 text-[30px] font-bold leading-none tracking-tight">
                {formatStat(overviewStatsReady, overviewAbsent)}
              </p>
            </div>
            <StatIcon from="#EF4444" to="#DC2626">
              <UserX className="size-5" />
            </StatIcon>
          </div>
          <p className="text-[12px]" style={{ color: MUTED }}>
            {overviewStatsReady ? `${absentPct}% of total` : "—"}
          </p>
        </article>

        <article className={cn(cardClass, "flex h-[120px] flex-col justify-between")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium" style={{ color: MUTED }}>
                New Joiners
              </p>
              <p className="mt-1 text-[30px] font-bold leading-none tracking-tight">
                {newJoinersCount.toLocaleString()}
              </p>
            </div>
            <StatIcon from="#3B82F6" to="#2563EB">
              <UserPlus className="size-5" />
            </StatIcon>
          </div>
          <Trend value={joinersDelta || presentTrendVsYesterday} />
        </article>
      </section>

      {/* Attendance | Trend | Calendar */}
      <section
        className="ca-fade mb-6 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3"
        style={{ animationDelay: "80ms" }}
      >
        <article className={cn(cardClass, ROW_CARD)}>
          <SectionTitle
            title="Attendance Overview"
            action={
              <span
                className="shrink-0 rounded-lg border bg-muted/60 px-2.5 py-1 text-[11px] font-medium"
                style={{ borderColor: BORDER, color: MUTED }}
              >
                {attPeriod}
              </span>
            }
          />
          <div className="flex min-h-0 flex-1 items-center gap-3 py-1">
            <div className="relative h-[150px] w-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={66}
                    paddingAngle={2}
                    strokeWidth={0}
                    animationDuration={900}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${BORDER}`,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[24px] font-bold leading-none">
                  {overviewStatsReady ? donutTotal.toLocaleString() : "—"}
                </span>
                <span className="mt-1 text-[11px]" style={{ color: MUTED }}>
                  Total
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2.5 overflow-hidden">
              {legend.map((item) => (
                <div key={item.name} className="flex min-w-0 items-center justify-between gap-2 text-[13px]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="truncate font-medium" style={{ color: MUTED }}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5 font-bold tabular-nums" style={{ color: TEXT }}>
                    <span className="text-[14px]">{overviewStatsReady ? item.value : "—"}</span>
                    <span className="w-11 text-right text-[13px] font-semibold" style={{ color: MUTED }}>
                      {overviewStatsReady ? `${item.percent}%` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ViewLink href="/attendance-reports">View Attendance Report</ViewLink>
        </article>

        <article className={cn(cardClass, ROW_CARD)}>
          <SectionTitle
            title="Employee Trend"
            action={
              <span
                className="shrink-0 rounded-lg border bg-muted/60 px-2.5 py-1 text-[11px] font-medium"
                style={{ borderColor: BORDER, color: MUTED }}
              >
                {trendPeriod}
              </span>
            }
          />
          <div className="min-h-0 flex-1">
            <div className="h-full min-h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="caEmpTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: MUTED, fontWeight: 500 }}
                />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  formatter={(value: number) => [value, "Present"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={PRIMARY}
                  strokeWidth={2.5}
                  fill="url(#caEmpTrend)"
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </div>
          <ViewLink href="/attendance-reports">View Full Report</ViewLink>
        </article>

        <article className={cn(cardClass, ROW_CARD)}>
          <DashboardCalendarCard
            todayDate={todayDate}
            eventDates={eventDates}
            schedules={schedules}
          />
        </article>
      </section>

      {/* Leave | Payroll | Recruitment | Quick Access */}
      <section
        className="ca-fade mb-6 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4"
        style={{ animationDelay: "120ms" }}
      >
        <article className={cn(cardClass, "flex flex-col")}>
          <SectionTitle
            title="Leave Summary"
            icon={
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Calendar className="size-4" />
              </span>
            }
            action={
              <span
                className="rounded-lg border bg-muted/60 px-2.5 py-1 text-[11px] font-medium"
                style={{ borderColor: BORDER, color: MUTED }}
              >
                This Month
              </span>
            }
          />
          <div>
            <SummaryListRow label="Total Leave" value={leaveTotal} />
            <SummaryListRow label="Approved" value={leaveApproved} valueColor={GREEN} />
            <SummaryListRow label="Pending" value={leavePending} valueColor={ORANGE} />
            <SummaryListRow label="Rejected" value={leaveRejected} valueColor={RED} last />
          </div>
          <ViewLink href="/leave-applications">View Leave Report</ViewLink>
        </article>

        <article className={cn(cardClass, "flex flex-col")}>
          <SectionTitle
            title="Payroll Summary"
            icon={
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Wallet className="size-4" />
              </span>
            }
            action={
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                <CheckCircle2 className="size-3" />
                Active
              </span>
            }
          />
          <div>
            <SummaryListRow
              label="Total Employees"
              value={(overviewTotal || employeesCount).toLocaleString()}
            />
            <SummaryListRow
              label="Salary Advances"
              value={advancePending}
              valueColor={ORANGE}
            />
            <SummaryListRow
              label="Reimbursements"
              value={reimbPending}
              valueColor={RED}
            />
            <SummaryListRow
              label="Payroll Date"
              value={payrollScheduleLabel(todayDate)}
              last
            />
          </div>
          <ViewLink href="/generate-salary">View Payroll Dashboard</ViewLink>
        </article>

        <article className={cn(cardClass, "flex flex-col")}>
          <SectionTitle
            title="Recruitment Summary"
            icon={
              <span className="flex size-8 items-center justify-center rounded-lg bg-fuchsia-50 text-fuchsia-600">
                <Briefcase className="size-4" />
              </span>
            }
            action={
              <span
                className="rounded-lg border bg-muted/60 px-2.5 py-1 text-[11px] font-medium"
                style={{ borderColor: BORDER, color: MUTED }}
              >
                This Month
              </span>
            }
          />
          <div>
            <SummaryListRow label="New Joiners" value={newJoinersCount} />
            <SummaryListRow label="Open Tasks" value={pendingCounts?.tasks ?? 0} />
            <SummaryListRow label="Pending IM" value={pendingCounts?.im ?? 0} valueColor={ORANGE} />
            <SummaryListRow label="Offers Sent" value={0} last />
          </div>
          <ViewLink href="/manage-employees">View Recruitment Dashboard</ViewLink>
        </article>

        <article className={cn(cardClass, "flex flex-col")}>
          <SectionTitle
            title="Quick Access"
            icon={
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Target className="size-4" />
              </span>
            }
          />
          <div className="grid grid-cols-4 gap-2">
            {QUICK_ACCESS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group flex flex-col items-center gap-1.5 text-center"
                >
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-[12px] transition-colors duration-200 group-hover:bg-blue-50 group-hover:text-blue-600",
                      item.tint,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[10px] font-medium leading-tight" style={{ color: MUTED }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </article>
      </section>

      {/* Department + Recent Activities */}
      <section
        className="ca-fade grid grid-cols-1 items-stretch gap-5 xl:grid-cols-12"
        style={{ animationDelay: "160ms" }}
      >
        <article className={cn(cardClass, "flex flex-col xl:col-span-8")}>
          <SectionTitle title="Department-wise Headcount" />
          <div className="h-[260px] w-full">
            {deptChart.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm" style={{ color: MUTED }}>
                No department headcount data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: MUTED, fontWeight: 500 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: MUTED }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(99,102,241,0.06)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${BORDER}`,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    formatter={(value: number, _n, item) => [
                      value,
                      (item?.payload as { fullName?: string })?.fullName || "Employees",
                    ]}
                  />
                  <Bar dataKey="count" fill={PRIMARY} radius={[8, 8, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className={cn(cardClass, "flex flex-col xl:col-span-4")}>
          <SectionTitle title="Recent Activities" />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {activityItems.length === 0 ? (
              <p className="flex h-full min-h-[200px] items-center justify-center py-8 text-center text-sm" style={{ color: MUTED }}>
                No recent activity yet.
              </p>
            ) : (
              activityItems.map((item, index) => {
                const colors = [PRIMARY, GREEN, ORANGE, BLUE, RED];
                const color = colors[index % colors.length];
                return (
                  <Link
                    key={item.id}
                    href={item.href || "#"}
                    className="flex items-start gap-3 rounded-[14px] px-2 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <span
                      className="mt-1.5 size-2.5 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{item.headline}</p>
                      <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
                        {item.body}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px]" style={{ color: MUTED }}>
                      {item.time}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
