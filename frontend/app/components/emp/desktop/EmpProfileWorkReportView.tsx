"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Clock, LineChart as LineChartIcon, Timer } from "lucide-react";
import {
  formatPunchTime,
  groupAttendanceByDay,
  lastNDaysRange,
  type AttendanceDaySummary,
  type AttendanceLocationRecord,
} from "@/app/utils/empAttendanceHistory";
import { formatWorkedDuration, formatWorkHoursDecimal } from "@/app/utils/attendanceDuration";
import { listCardClass, listSelectTriggerClass } from "@/app/components/app/list-ui-styles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type RangeMode = "week" | "month";
type MetricMode = "hours" | "checkin" | "checkout";

function dateKeyToLabel(dateKey: string, mode: RangeMode) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  if (mode === "week") {
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function punchHourDecimal(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

function formatHoursLabel(hours: number) {
  const totalMin = Math.round(hours * 60);
  return formatWorkedDuration(totalMin);
}

function buildRange(mode: RangeMode) {
  return lastNDaysRange(mode === "week" ? 7 : 30);
}

function fillDaySeries(
  days: AttendanceDaySummary[],
  mode: RangeMode,
): AttendanceDaySummary[] {
  const range = buildRange(mode);
  const byKey = new Map(days.map((d) => [d.dateKey, d]));
  const out: AttendanceDaySummary[] = [];
  const start = new Date(`${range.from}T12:00:00Z`);
  const end = new Date(`${range.to}T12:00:00Z`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const key = d.toISOString().slice(0, 10);
    const existing = byKey.get(key);
    out.push(
      existing ?? {
        dateKey: key,
        date: key,
        checkIn: null,
        checkOut: null,
        workSeconds: 0,
        breakSeconds: 0,
        workLabel: "0.00h",
        breakLabel: "0m",
        accuracy: null,
        records: [],
      },
    );
  }
  return out;
}

function WorkReportTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { label: string } }>;
  metric: MetricMode;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  const label =
    metric === "hours"
      ? formatHoursLabel(value)
      : `${String(Math.floor(value)).padStart(2, "0")}:${String(Math.round((value % 1) * 60)).padStart(2, "0")}`;
  return (
    <div className="rounded-lg bg-[#374151] px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg">
      {label}
    </div>
  );
}

export function EmpProfileWorkReportView({
  employeeId: viewEmployeeId,
}: {
  employeeId?: number;
} = {}) {
  const [rangeMode, setRangeMode] = useState<RangeMode>("week");
  const [metric, setMetric] = useState<MetricMode>("hours");
  const [days, setDays] = useState<AttendanceDaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (mode: RangeMode) => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
          : "";
      if (!token) {
        setDays([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const range = buildRange(mode);
      try {
        const attUrl = viewEmployeeId
          ? `${BACKEND}/emp-manager-scope/member/${viewEmployeeId}/attendance-history?from=${range.from}&to=${range.to}`
          : `${BACKEND}/emp-location-attendance/my?from=${range.from}&to=${range.to}`;
        const res = await fetch(attUrl, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          setDays([]);
          return;
        }
        const data = await res.json();
        let records: AttendanceLocationRecord[] = [];
        if (Array.isArray(data)) {
          records = data;
        } else if (Array.isArray(data?.records)) {
          records = data.records;
        }
        setDays(groupAttendanceByDay(records));
      } catch {
        setDays([]);
      } finally {
        setLoading(false);
      }
    },
    [viewEmployeeId],
  );

  useEffect(() => {
    void load(rangeMode);
  }, [load, rangeMode]);

  const seriesDays = useMemo(() => fillDaySeries(days, rangeMode), [days, rangeMode]);

  const chartData = useMemo(() => {
    return seriesDays.map((d) => {
      const hours = d.workSeconds / 3600;
      const checkIn = punchHourDecimal(d.checkIn);
      const checkOut = punchHourDecimal(d.checkOut);
      const primary =
        metric === "hours" ? hours : metric === "checkin" ? checkIn ?? 0 : checkOut ?? 0;
      const secondary =
        metric === "hours"
          ? Math.max(0, hours * 0.55)
          : metric === "checkin"
            ? checkOut ?? 0
            : checkIn ?? 0;
      return {
        key: d.dateKey,
        label: dateKeyToLabel(d.dateKey, rangeMode),
        primary: Number(primary.toFixed(2)),
        secondary: Number(secondary.toFixed(2)),
        workLabel: formatHoursLabel(hours),
        checkInLabel: formatPunchTime(d.checkIn),
        checkOutLabel: formatPunchTime(d.checkOut),
        present: d.workSeconds > 0 || !!d.checkIn,
      };
    });
  }, [seriesDays, metric, rangeMode]);

  const stats = useMemo(() => {
    const worked = seriesDays.filter((d) => d.workSeconds > 0 || d.checkIn);
    const totalSec = seriesDays.reduce((s, d) => s + d.workSeconds, 0);
    const avgSec = worked.length ? totalSec / worked.length : 0;
    const onTime = worked.filter((d) => {
      const h = punchHourDecimal(d.checkIn);
      return h != null && h <= 10.5;
    }).length;
    const completion = seriesDays.length
      ? Math.round((worked.length / seriesDays.length) * 100)
      : 0;
    return {
      totalHours: formatWorkHoursDecimal(totalSec),
      avgHours: formatHoursLabel(avgSec / 3600),
      daysPresent: worked.length,
      daysExpected: seriesDays.length,
      onTimeRate: worked.length ? Math.round((onTime / worked.length) * 100) : 0,
      completion,
    };
  }, [seriesDays]);

  const yDomain =
    metric === "hours"
      ? ([0, "auto"] as const)
      : ([8, 20] as const);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: rangeMode === "week" ? "Hours this week" : "Hours this month",
            value: stats.totalHours,
            icon: Clock,
          },
          {
            label: "Avg daily work",
            value: stats.avgHours,
            icon: Timer,
          },
          {
            label: "Days present",
            value: `${stats.daysPresent}/${stats.daysExpected}`,
            icon: Activity,
          },
          {
            label: "On-time check-ins",
            value: `${stats.onTimeRate}%`,
            icon: LineChartIcon,
          },
        ].map((card) => (
          <div key={card.label} className={cn(listCardClass, "p-4")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  {loading ? "…" : card.value}
                </p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <card.icon className="size-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={cn(listCardClass, "p-5")}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Work Report</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Check-in / check-out based work hours for the selected period
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Select value={rangeMode} onValueChange={(v) => setRangeMode(v as RangeMode)}>
              <SelectTrigger className={cn(listSelectTriggerClass, "w-[140px]")} aria-label="Period">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricMode)}>
              <SelectTrigger className={cn(listSelectTriggerClass, "w-[160px]")} aria-label="Metric">
                <div className="flex items-center gap-2">
                  <LineChartIcon className="size-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Logged hours</SelectItem>
                <SelectItem value="checkin">Check-in time</SelectItem>
                <SelectItem value="checkout">Check-out time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading work report…</p>
        ) : (
          <div className="h-[270px] w-full sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="workReportPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="workReportSecondary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#93C5FD" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#93C5FD" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280", fontWeight: 500 }}
                  interval={rangeMode === "month" ? 3 : 0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9CA3AF" }}
                  domain={yDomain as unknown as [number, number | "auto"]}
                  tickFormatter={(v) =>
                    metric === "hours" ? String(v) : `${Math.floor(Number(v))}:00`
                  }
                />
                <Tooltip
                  content={<WorkReportTooltip metric={metric} />}
                  cursor={{ stroke: "#9CA3AF", strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="secondary"
                  stroke="#93C5FD"
                  strokeWidth={2}
                  fill="url(#workReportSecondary)"
                  isAnimationActive
                  animationDuration={800}
                />
                <Area
                  type="monotone"
                  dataKey="primary"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="url(#workReportPrimary)"
                  activeDot={{ r: 5, fill: "#3B82F6", strokeWidth: 0 }}
                  isAnimationActive
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
