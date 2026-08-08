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
  lastCalendarYearRange,
  lastNDaysRange,
  lastNMonthsRange,
  lastQuarterRange,
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
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type PeriodPreset =
  | "custom"
  | "last-month"
  | "last-quarter"
  | "last-six-months"
  | "last-year";
type MetricMode = "hours" | "checkin" | "checkout";

function dateKeyToLabel(dateKey: string, spanDays: number) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  if (spanDays <= 14) {
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });
  }
  if (spanDays <= 62) {
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
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

function resolvePeriodRange(
  preset: PeriodPreset,
  fromDate: string,
  toDate: string,
): { from: string; to: string } {
  if (preset === "last-year") return lastCalendarYearRange();
  if (preset === "last-six-months") return lastNMonthsRange(6);
  if (preset === "last-quarter") return lastQuarterRange();
  if (preset === "last-month") return lastNDaysRange(30);
  if (fromDate && toDate) return { from: fromDate, to: toDate };
  return lastNDaysRange(30);
}

function fillDaySeries(
  days: AttendanceDaySummary[],
  range: { from: string; to: string },
): AttendanceDaySummary[] {
  const byKey = new Map(days.map((d) => [d.dateKey, d]));
  const out: AttendanceDaySummary[] = [];
  const start = new Date(`${range.from}T12:00:00Z`);
  const end = new Date(`${range.to}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
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
  const defaultRange = lastNDaysRange(30);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("last-month");
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [metric, setMetric] = useState<MetricMode>("hours");
  const [days, setDays] = useState<AttendanceDaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (range: { from: string; to: string }) => {
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
    void load(appliedRange);
  }, [load, appliedRange]);

  const applyPeriod = (preset: PeriodPreset, from = fromDate, to = toDate) => {
    const range = resolvePeriodRange(preset, from, to);
    setPeriodPreset(preset);
    setFromDate(range.from);
    setToDate(range.to);
    setAppliedRange(range);
  };

  const seriesDays = useMemo(() => fillDaySeries(days, appliedRange), [days, appliedRange]);
  const spanDays = seriesDays.length || 30;

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
        label: dateKeyToLabel(d.dateKey, spanDays),
        primary: Number(primary.toFixed(2)),
        secondary: Number(secondary.toFixed(2)),
        workLabel: formatHoursLabel(hours),
        checkInLabel: formatPunchTime(d.checkIn),
        checkOutLabel: formatPunchTime(d.checkOut),
        present: d.workSeconds > 0 || !!d.checkIn,
      };
    });
  }, [seriesDays, metric, spanDays]);

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
            label: "Hours in period",
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
            <Select
              value={periodPreset}
              onValueChange={(v) => {
                const preset = v as PeriodPreset;
                if (preset === "custom") {
                  setPeriodPreset("custom");
                  return;
                }
                applyPeriod(preset);
              }}
            >
              <SelectTrigger className={cn(listSelectTriggerClass, "w-[180px]")} aria-label="Period">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">From / To date</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-quarter">Last Quarter</SelectItem>
                <SelectItem value="last-six-months">Last Six Months</SelectItem>
                <SelectItem value="last-year">Last Year</SelectItem>
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

        {periodPreset === "custom" ? (
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From Date</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To Date</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!fromDate || !toDate || fromDate > toDate}
              onClick={() => applyPeriod("custom", fromDate, toDate)}
            >
              Apply
            </Button>
          </div>
        ) : null}

        <div className="h-[280px] w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="workReportFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  interval={spanDays > 90 ? Math.floor(spanDays / 12) : "preserveStartEnd"}
                />
                <YAxis
                  domain={yDomain as unknown as [number, number | "auto"]}
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<WorkReportTooltip metric={metric} />} />
                <Area
                  type="monotone"
                  dataKey="primary"
                  stroke="#3B82F6"
                  fill="url(#workReportFill)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
