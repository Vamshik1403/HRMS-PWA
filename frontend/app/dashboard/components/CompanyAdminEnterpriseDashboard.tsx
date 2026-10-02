"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
/** Calendar spans KPI row + middle row — taller from the top */
const CALENDAR_SPAN_CARD =
  "flex min-h-0 flex-col overflow-hidden";

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

export type EnterpriseTaskItem = {
  id: number;
  taskCode: string;
  taskName: string;
  status: string;
  priority: string;
  dueDateTime: string | null;
  createdAt: string;
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
  latestTasks: EnterpriseTaskItem[];
  activityItems: ActivityItem[];
  pendingCounts: EnterprisePendingCounts | null;
  /** When true, page title is shown in the portal navbar instead of the content header. */
  suppressPageTitle?: boolean;
};

type CalendarEventKind = "birthday" | "anniversary" | "holiday" | "task" | "onboarding";

type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  detail: string;
  date: string;
};

const KIND_DOT: Record<CalendarEventKind, string> = {
  birthday: "bg-pink-500",
  anniversary: "bg-violet-500",
  holiday: "bg-amber-500",
  task: "bg-sky-500",
  onboarding: "bg-emerald-500",
};

const KIND_LABEL: Record<CalendarEventKind, string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  holiday: "Holiday",
  task: "Task",
  onboarding: "Onboarding",
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
  events,
}: {
  todayDate: string;
  events: CalendarEvent[];
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
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth],
  );

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.date.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events]);

  const monthPrefix = `${viewYear}-${pad2(viewMonth)}`;
  const monthSchedules = useMemo(() => {
    return events
      .filter((e) => {
        const d = e.date.slice(0, 10);
        if (!d.startsWith(monthPrefix)) return false;
        // Upcoming only: today and future (calendar still shows past dots)
        return d >= todayDate;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, monthPrefix, todayDate]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  };

  const openNotifications = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("hrms-open-admin-notifications"));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
            aria-label="Next month"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-0 shrink-0 grid grid-cols-7 text-center text-[9px] font-medium text-slate-500 dark:text-slate-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>

      <div className="relative shrink-0 grid grid-cols-7 text-center">
        {cells.map((cell, index) => {
          const col = index % 7;
          const row = Math.floor(index / 7);
          const dow = new Date(`${cell.dateKey}T12:00:00`).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isToday = cell.dateKey === todayDate;
          const dayEvents = eventsByDate.get(cell.dateKey) ?? [];
          const hasEvent = dayEvents.length > 0;
          const tooltip = dayEvents
            .map((e) => `${KIND_LABEL[e.kind]}: ${e.title}`)
            .join("\n");
          const dots = Array.from(new Set(dayEvents.map((e) => e.kind))).slice(0, 3);
          // Keep tooltip inside card: flip for edge columns / top rows
          const tipX =
            col >= 5
              ? "right-0 left-auto translate-x-0"
              : col <= 1
                ? "left-0 translate-x-0"
                : "left-1/2 -translate-x-1/2";
          const tipY =
            row <= 1
              ? "top-full bottom-auto mt-1"
              : "bottom-full top-auto mb-1";

          return (
            <div
              key={cell.dateKey}
              className="relative flex flex-col items-center justify-center py-0.5"
              onMouseEnter={() => hasEvent && setHoveredKey(cell.dateKey)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              <span
                title={tooltip || undefined}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px] font-medium tabular-nums leading-none",
                  cell.outside && "text-muted-foreground/40",
                  !cell.outside && isWeekend && !isToday && "text-rose-500 dark:text-rose-400",
                  !cell.outside && !isWeekend && !isToday && !hasEvent && "text-foreground",
                  !cell.outside && hasEvent && !isToday && "font-semibold text-primary",
                  isToday && "bg-blue-500 font-bold text-white shadow-sm",
                )}
              >
                {cell.day}
              </span>
              {!cell.outside && hasEvent ? (
                <div className="flex h-1.5 items-center justify-center gap-0.5">
                  {dots.map((kind) => (
                    <span
                      key={kind}
                      className={cn("size-1 rounded-full", KIND_DOT[kind])}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-1.5" />
              )}
              {hoveredKey === cell.dateKey && hasEvent && (
                <div
                  className={cn(
                    "pointer-events-none absolute z-30 w-[140px] max-w-[140px] rounded-md border border-border bg-popover px-2 py-1.5 text-left text-[10px] shadow-md",
                    tipX,
                    tipY,
                  )}
                >
                  {dayEvents.slice(0, 4).map((e) => (
                    <p key={e.id} className="truncate text-popover-foreground">
                      <span
                        className={cn(
                          "mr-1 inline-block size-1.5 rounded-full align-middle",
                          KIND_DOT[e.kind],
                        )}
                      />
                      {e.title}
                    </p>
                  ))}
                  {dayEvents.length > 4 && (
                    <p className="text-muted-foreground">+{dayEvents.length - 4} more</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex shrink-0 items-center justify-between gap-2 border-t border-border pt-1.5">
        <h4 className="text-[12px] font-semibold text-foreground">Upcoming Schedules</h4>
        <button
          type="button"
          onClick={openNotifications}
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          See all
        </button>
      </div>

      <div className="mt-1 max-h-64 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5 xl:max-h-none">
        {monthSchedules.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-muted-foreground">No upcoming schedules</p>
        ) : (
          monthSchedules.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-background px-2 py-1.5"
            >
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className={cn("size-1.5 shrink-0 rounded-full", KIND_DOT[item.kind])} />
                <p className="text-[9px] text-muted-foreground">
                  {new Date(`${item.date.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
                  {KIND_LABEL[item.kind]}
                </p>
              </div>
              <p className="truncate text-[11px] font-bold text-foreground">{item.title}</p>
              {item.detail ? (
                <p className="truncate text-[9px] text-muted-foreground">{item.detail}</p>
              ) : null}
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

function useCountUp(target: number, enabled: boolean, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setValue(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, duration]);
  return value;
}

function RadialRing({
  percent,
  colorFrom,
  colorTo,
  label,
}: {
  percent: number;
  colorFrom: string;
  colorTo: string;
  label: string;
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(safe));
    return () => cancelAnimationFrame(id);
  }, [safe]);

  const size = 72;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (drawn / 100) * c;
  const gradId = `ring-${colorFrom.replace("#", "")}`;

  return (
    <div className="relative size-[72px] shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorFrom} />
            <stop offset="100%" stopColor={colorTo} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200 dark:text-slate-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 750ms ease-out" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[14px] font-bold leading-none tabular-nums text-slate-900 dark:text-slate-50">
          {Math.round(safe)}%
        </span>
        <span className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
    </div>
  );
}

function WorkforceAreaChart({
  accent = "#6366F1",
  values,
}: {
  accent?: string;
  values?: number[];
}) {
  const data = useMemo(() => {
    const series =
      values && values.length >= 2
        ? values.slice(-7)
        : [18, 24, 20, 28, 26, 32, 36];
    return series.map((y, i) => ({ x: String(i), y }));
  }, [values]);
  const gradId = `kpiWorkforceFill-${accent.replace("#", "")}`;

  return (
    <div className="h-[38px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="y"
            stroke={accent}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            activeDot={false}
            isAnimationActive
            animationDuration={750}
            animationEasing="ease-out"
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (index !== data.length - 1 || cx == null || cy == null) {
                return <g key={`kpi-dot-empty-${index ?? 0}`} />;
              }
              return (
                <g key="kpi-dot-glow">
                  <circle cx={cx} cy={cy} r={7} fill={accent} opacity={0.18} />
                  <circle cx={cx} cy={cy} r={3.5} fill={accent} />
                  <circle cx={cx} cy={cy} r={1.5} fill="#fff" />
                </g>
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricSparkline({
  accent,
  values,
}: {
  accent: string;
  values: number[];
}) {
  const data = useMemo(() => {
    const series = values.length >= 2 ? values.slice(-7) : [2, 4, 3, 5, 4, 6, 5];
    return series.map((y, i) => ({ x: String(i), y }));
  }, [values]);
  const gradId = `kpiSparkFill-${accent.replace("#", "")}`;

  return (
    <div className="h-[28px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="y"
            stroke={accent}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={false}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function JoinersMiniBars({ values, accent = "#38BDF8" }: { values: number[]; accent?: string }) {
  const bars = values.length >= 7 ? values.slice(-7) : [...Array(Math.max(0, 7 - values.length)).fill(0), ...values];
  const max = Math.max(...bars, 1);

  return (
    <div className="flex h-9 items-end justify-between gap-1.5">
      {bars.map((v, i) => {
        const h = Math.max(6, Math.round((v / max) * 36));
        const latest = i === bars.length - 1;
        return (
          <div
            key={i}
            className="w-full max-w-[10px] rounded-full transition-[height] duration-700 ease-out"
            style={{
              height: `${h}px`,
              background: latest
                ? `linear-gradient(180deg, ${accent}, ${accent}99)`
                : `${accent}55`,
              boxShadow: latest ? `0 0 0 1.5px ${accent}, 0 0 10px ${accent}55` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function EnterpriseKpiShell({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full min-h-[176px] flex-col overflow-hidden rounded-[24px] border border-border bg-card p-4 xl:p-5",
        "shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition-colors duration-200",
        "hover:border-slate-400/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-border",
      )}
    >
      {children}
    </Link>
  );
}

function KpiNumber({ value, ready }: { value: number; ready: boolean }) {
  const counted = useCountUp(ready ? value : 0, ready);
  return (
    <p className="text-[42px] font-semibold leading-none tracking-tight text-slate-800 tabular-nums dark:text-white">
      {ready ? counted.toLocaleString() : "—"}
    </p>
  );
}

function KpiTitle({
  icon,
  label,
  color,
}: {
  icon: ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="inline-flex size-5 shrink-0 items-center justify-center" style={{ color }}>
        {icon}
      </span>
      <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300">{label}</p>
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
    <div className="mb-3 flex items-center justify-between gap-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {icon}
        <h2 className="whitespace-nowrap text-[14px] font-semibold leading-none tracking-tight text-foreground sm:text-[15px]">
          {title}
        </h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
  presentTrendVsYesterday: _presentTrendVsYesterday,
  newJoinersCount,
  statusBreakdown,
  attendanceTrend,
  departmentHeadcounts,
  upcomingEvents,
  newsFeed,
  latestTasks,
  activityItems,
  pendingCounts,
  suppressPageTitle = false,
}: CompanyAdminEnterpriseDashboardProps) {
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

  const shortDate = useMemo(() => {
    const d = new Date(`${todayDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return todayDate;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [todayDate]);

  const dateBadge = (
    <span
      className="shrink-0 whitespace-nowrap rounded-md border bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium tabular-nums"
      style={{ borderColor: BORDER, color: MUTED }}
    >
      {shortDate}
    </span>
  );

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

  const calendarEvents = useMemo(() => {
    const items: CalendarEvent[] = [];
    const seen = new Set<string>();

    for (const e of upcomingEvents) {
      const date = e.date?.slice(0, 10);
      if (!date || seen.has(e.id)) continue;
      seen.add(e.id);
      items.push({
        id: e.id,
        kind: e.kind,
        title: e.label,
        detail: e.when,
        date,
      });
    }

    for (const n of newsFeed) {
      const date = n.date?.slice(0, 10);
      if (!date || seen.has(n.id)) continue;
      seen.add(n.id);
      if (n.kind === "holiday") {
        items.push({
          id: n.id,
          kind: "holiday",
          title: n.title.replace(/\s+(today|tomorrow)$/i, "").trim() || "Public holiday",
          detail: "",
          date,
        });
      } else if (n.kind === "onboarding") {
        items.push({
          id: n.id,
          kind: "onboarding",
          title: n.title,
          detail: n.subtitle || "New joiner",
          date,
        });
      }
    }

    for (const t of latestTasks) {
      if (!t.dueDateTime) continue;
      const due = new Date(t.dueDateTime);
      if (Number.isNaN(due.getTime())) continue;
      const date = `${due.getFullYear()}-${pad2(due.getMonth() + 1)}-${pad2(due.getDate())}`;
      const id = `task-${t.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        kind: "task",
        title: t.taskName || t.taskCode || "Task",
        detail: `${t.priority || "Normal"} · ${t.status || "Open"}`,
        date,
      });
    }

    items.sort((a, b) => a.date.localeCompare(b.date));
    return items;
  }, [upcomingEvents, newsFeed, latestTasks]);

  const legend = [
    { name: "Present", value: overviewPresent, percent: presentPct, color: GREEN },
    { name: "On Leave", value: overviewOnLeave, percent: leavePct, color: ORANGE },
    { name: "Absent", value: overviewAbsent, percent: absentPct, color: RED },
    { name: "Half Day", value: overviewHalfDay, percent: halfPct, color: PRIMARY },
  ];

  const sparkValues = useMemo(() => {
    const fromTrend = attendanceTrend.map((p) => Number(p.value) || 0).slice(-7);
    if (fromTrend.length >= 2) return fromTrend;
    const base = Math.max(newJoinersCount, 1);
    return [1, 2, 3, 2, 4, 5, base];
  }, [attendanceTrend, newJoinersCount]);

  const presentSeries = useMemo(() => {
    const fromTrend = attendanceTrend.map((p) => Number(p.value) || 0).slice(-7);
    if (fromTrend.length >= 2) return fromTrend;
    return [overviewPresent, overviewPresent, overviewPresent, overviewPresent, overviewPresent, overviewPresent, overviewPresent];
  }, [attendanceTrend, overviewPresent]);

  const absentSeries = useMemo(
    () => Array.from({ length: 7 }, (_, i) => Math.max(0, overviewAbsent + ((i % 2) === 0 ? 0 : -1))),
    [overviewAbsent],
  );

  const workforceTotal = overviewTotal || employeesCount;
  const statsReady = overviewStatsReady || employeesCount > 0;

  return (
    <div
      className={cn(
        "ca-enterprise-dashboard -mx-4 -mb-6 min-h-full bg-background px-4 pb-8 text-foreground sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        suppressPageTitle
          ? "-mt-3 pt-1 sm:-mt-3.5 lg:-mt-4"
          : "-mt-3 pt-0 sm:-mt-4 lg:-mt-5",
      )}
    >
      <style jsx global>{`
        /* Opacity-only fade — transforms keep a compositor layer and blur text at 100% zoom */
        .ca-enterprise-dashboard .ca-fade {
          animation: caFadeIn 0.35s ease-out both;
        }
        @keyframes caFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .ca-enterprise-dashboard {
          -webkit-font-smoothing: auto;
          -moz-osx-font-smoothing: auto;
          text-rendering: auto;
          font-synthesis: none;
        }
        .ca-enterprise-dashboard .text-muted-foreground {
          color: hsl(215 16% 47%) !important;
          font-weight: 400;
        }
        .ca-enterprise-dashboard p,
        .ca-enterprise-dashboard span,
        .ca-enterprise-dashboard li,
        .ca-enterprise-dashboard a,
        .ca-enterprise-dashboard button,
        .ca-enterprise-dashboard label {
          -webkit-font-smoothing: auto;
          -moz-osx-font-smoothing: auto;
        }
      `}</style>

      {/* Header */}
      <header
        className={cn(
          "ca-fade",
          suppressPageTitle
            ? "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            : "mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between",
        )}
      >
        {suppressPageTitle ? (
          <>
            <h1
              className="text-[28px] font-semibold tracking-tight leading-none text-slate-900 dark:text-slate-100"
              style={{ color: TEXT }}
            >
              Welcome back, {formatWelcomeName(firstName)}
            </h1>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center shrink-0">
              <div className="inline-flex h-[42px] items-center gap-2 rounded-[14px] border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm">
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
          </>
        ) : (
          <>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight" style={{ color: TEXT }}>
                Dashboard
              </h1>
              <p className="mt-1 text-[15px] font-semibold text-slate-800 dark:text-slate-200">
                Welcome back, {formatWelcomeName(firstName)}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex h-[42px] items-center gap-2 rounded-[14px] border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm">
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
          </>
        )}
      </header>

      {/* KPIs (4) + Attendance / Trend + tall Calendar */}
      <section
        className="ca-fade mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12 xl:grid-rows-[auto_300px] xl:gap-5"
        style={{ animationDelay: "40ms" }}
      >
        <div className="xl:col-span-2">
          <EnterpriseKpiShell href="/manage-employees">
            <KpiTitle
              icon={<Users className="size-5" strokeWidth={1.75} />}
              label="Total Employees"
              color="#6366F1"
            />
            <div className="mt-4">
              <KpiNumber value={workforceTotal} ready={statsReady} />
              <p className="mt-1.5 text-[13px] font-normal text-slate-500 dark:text-slate-400">Active Workforce</p>
            </div>
            <div className="mt-auto pt-4">
              <WorkforceAreaChart
                accent="#6366F1"
                values={[
                  Math.max(1, workforceTotal - 3),
                  Math.max(1, workforceTotal - 2),
                  Math.max(1, workforceTotal - 2),
                  Math.max(1, workforceTotal - 1),
                  workforceTotal,
                  workforceTotal,
                  workforceTotal,
                ]}
              />
            </div>
          </EnterpriseKpiShell>
        </div>

        <div className="xl:col-span-2">
          <EnterpriseKpiShell href="/attendance-logs?presence=present">
            <KpiTitle
              icon={<UserCheck className="size-5" strokeWidth={1.75} />}
              label="Present Today"
              color="#16A34A"
            />
            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <KpiNumber value={overviewPresent} ready={overviewStatsReady} />
                <p className="mt-1.5 text-[13px] font-normal text-slate-500 dark:text-slate-400">
                  of {statsReady ? workforceTotal.toLocaleString() : "—"} employees
                </p>
              </div>
              <RadialRing percent={presentPct} colorFrom="#86EFAC" colorTo="#16A34A" label="Present" />
            </div>
            <div className="mt-auto pt-3">
              <MetricSparkline accent="#22C55E" values={presentSeries} />
            </div>
          </EnterpriseKpiShell>
        </div>

        <div className="xl:col-span-2">
          <EnterpriseKpiShell href="/attendance-logs?presence=absent">
            <KpiTitle
              icon={<UserX className="size-5" strokeWidth={1.75} />}
              label="Absent Today"
              color="#DC2626"
            />
            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <KpiNumber value={overviewAbsent} ready={overviewStatsReady} />
                <p className="mt-1.5 text-[13px] font-normal text-slate-500 dark:text-slate-400">
                  of {statsReady ? workforceTotal.toLocaleString() : "—"} employees
                </p>
              </div>
              <RadialRing percent={absentPct} colorFrom="#FCA5A5" colorTo="#DC2626" label="Absent" />
            </div>
            <div className="mt-auto pt-3">
              <MetricSparkline accent="#EF4444" values={absentSeries} />
            </div>
          </EnterpriseKpiShell>
        </div>

        <div className="xl:col-span-2">
          <EnterpriseKpiShell href="/new-joiners">
            <KpiTitle
              icon={<UserPlus className="size-5" strokeWidth={1.75} />}
              label="New Joiners"
              color="#0EA5E9"
            />
            <div className="mt-4">
              <KpiNumber value={newJoinersCount} ready />
              <p className="mt-1.5 text-[13px] font-normal text-slate-500 dark:text-slate-400">This Month</p>
            </div>
            <div className="mt-auto pt-4">
              <JoinersMiniBars values={sparkValues} accent="#38BDF8" />
            </div>
          </EnterpriseKpiShell>
        </div>

        <article className={cn(cardClass, CALENDAR_SPAN_CARD, "xl:col-span-4 xl:row-span-2")}>
          <DashboardCalendarCard
            todayDate={todayDate}
            events={calendarEvents}
          />
        </article>

        <article className={cn(cardClass, ROW_CARD, "xl:col-span-4")}>
          <SectionTitle
            title="Attendance Overview"
            action={dateBadge}
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
                  <span
                    className="shrink-0 pr-3 text-right text-[14px] font-bold tabular-nums"
                    style={{ color: TEXT }}
                  >
                    {overviewStatsReady ? item.value : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <ViewLink href="/attendance-reports">View Attendance Report</ViewLink>
        </article>

        <article className={cn(cardClass, ROW_CARD, "xl:col-span-4")}>
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
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Calendar className="size-3.5" />
              </span>
            }
            action={dateBadge}
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
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-fuchsia-50 text-fuchsia-600">
                <Briefcase className="size-3.5" />
              </span>
            }
            action={dateBadge}
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
          <div className="grid grid-cols-4 gap-x-2 gap-y-3">
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
                  <span className="text-[10px] font-semibold leading-tight" style={{ color: MUTED }}>
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

        <article className={cn(cardClass, "flex min-h-[300px] max-h-[320px] flex-col xl:col-span-4")}>
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
