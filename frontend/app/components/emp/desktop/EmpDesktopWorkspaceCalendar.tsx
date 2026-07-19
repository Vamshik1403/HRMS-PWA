"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { Button } from "../../ui/button";
import {
  groupAttendanceByDay,
  encodeDateKey,
  type AttendanceDaySummary,
} from "../../../utils/empAttendanceHistory";
import { todayPunchDateKey } from "../../../utils/attendanceDuration";
import {
  expandHolidayDateMap,
  resolveCalendarDayDisplay,
  type CalendarDayKind,
} from "../../../utils/empCalendarDayStatus";
import { buildWeekOffDayNames, isWeekOffDate, type WorkShiftDayRow } from "../../../utils/empWorkShiftWeekOff";
import type { EmpHolidayRow } from "../EmpHolidayListMobile";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LEGEND: { kind: CalendarDayKind; label: string; dot: string }[] = [
  { kind: "present", label: "Present", dot: "bg-emerald-500" },
  { kind: "absent", label: "Absent", dot: "bg-rose-500" },
  { kind: "leave", label: "Leave", dot: "bg-sky-500" },
  { kind: "holiday", label: "Holiday", dot: "bg-violet-500" },
  { kind: "weekoff", label: "Week off", dot: "bg-amber-500" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthRange(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(last)}`,
  };
}

function buildMonthCells(year: number, month: number) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const cells: { dateKey: string | null; day: number | null; outside?: boolean }[] = [];

  for (let i = firstDow - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    cells.push({
      dateKey: `${py}-${pad2(pm)}-${pad2(day)}`,
      day,
      outside: true,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateKey: `${year}-${pad2(month)}-${pad2(d)}`, day: d });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    cells.push({
      dateKey: `${ny}-${pad2(nm)}-${pad2(d)}`,
      day: d,
      outside: true,
    });
  }

  return cells;
}

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const kindAccent: Record<CalendarDayKind, string> = {
  present: "border-l-emerald-500 bg-emerald-50/40",
  absent: "border-l-rose-400 bg-rose-50/30",
  holiday: "border-l-violet-500 bg-violet-50/40",
  weekoff: "border-l-amber-500 bg-amber-50/40",
  leave: "border-l-sky-500 bg-sky-50/40",
  none: "border-l-transparent",
};

const kindBadge: Record<CalendarDayKind, string> = {
  present: "bg-emerald-100 text-emerald-800",
  absent: "bg-rose-100 text-rose-700",
  holiday: "bg-violet-100 text-violet-800",
  weekoff: "bg-amber-100 text-amber-800",
  leave: "bg-sky-100 text-sky-800",
  none: "",
};

export function EmpDesktopWorkspaceCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<AttendanceDaySummary[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<Set<string>>(new Set());
  const [holidayMap, setHolidayMap] = useState<Map<string, string>>(new Map());
  const [leaves, setLeaves] = useState<
    { fromDate?: string; toDate?: string; status?: string; appliedLeaveType?: string; dayStatuses?: unknown }[]
  >([]);

  const todayKey = todayPunchDateKey();

  const loadMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    const { from, to } = monthRange(year, month);
    try {
      const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empId = user?.employee?.id;

      const [attendanceData, holidaysData, leaveData, empData] = await Promise.all([
        fetch(`${BACKEND}/emp-location-attendance/my?from=${from}&to=${to}`, {
          headers: authHeaders(),
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${BACKEND}/emp-notifications/holidays`, {
          headers: authHeaders(),
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : [])),
        empId != null
          ? fetch(`${BACKEND}/leave-application/employee/${empId}`, {
              headers: authHeaders(),
              cache: "no-store",
            }).then((r) => (r.ok ? r.json() : []))
          : Promise.resolve([]),
        empId != null
          ? fetch(`${BACKEND}/manage-emp/${empId}`, { headers: authHeaders(), cache: "no-store" }).then((r) =>
              r.ok ? r.json() : null,
            )
          : Promise.resolve(null),
      ]);

      setDays(groupAttendanceByDay(Array.isArray(attendanceData) ? attendanceData : []));
      setHolidayMap(
        expandHolidayDateMap(
          (Array.isArray(holidaysData) ? holidaysData : []).map((h: EmpHolidayRow) => ({
            name: h.name,
            startDate: h.startDate,
            endDate: h.endDate,
          })),
        ),
      );
      setLeaves(Array.isArray(leaveData) ? leaveData : []);

      const workShiftId = empData?.workShiftID ?? empData?.workShift?.id;
      if (workShiftId) {
        const shiftRes = await fetch(`${BACKEND}/work-shift/${workShiftId}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (shiftRes.ok) {
          const shift = await shiftRes.json();
          const shiftDays: WorkShiftDayRow[] = Array.isArray(shift?.workShiftDay) ? shift.workShiftDay : [];
          setWeekOffDays(buildWeekOffDayNames(shiftDays));
        } else {
          setWeekOffDays(new Set());
        }
      } else {
        setWeekOffDays(new Set());
      }
    } catch {
      setDays([]);
      setHolidayMap(new Map());
      setLeaves([]);
      setWeekOffDays(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, loadMonth]);

  const dayMap = useMemo(() => new Map(days.map((d) => [d.dateKey, d])), [days]);
  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthLabel = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(viewYear, viewMonth - 1 + delta, 1));
    setViewYear(d.getUTCFullYear());
    setViewMonth(d.getUTCMonth() + 1);
  };

  return (
    <EmpDesktopPage
      title="My Calendar"
      description="Monthly attendance with present, absent, leave, holiday, and week off"
      icon={Calendar}
    >
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border bg-gradient-to-r from-muted/40 to-card">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
            <h2 className="ml-1 text-lg font-semibold text-foreground">{monthLabel}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {LEGEND.map((item) => (
              <span key={item.kind} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn("size-2 rounded-full", item.dot)} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn(
                "py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide",
                i === 0 || i === 6 ? "text-muted-foreground/70" : "text-muted-foreground",
              )}
            >
              {w}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-px bg-border p-px">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[108px] bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px bg-border">
            {cells.map((cell, idx) => {
              if (!cell.dateKey || cell.day == null) {
                return <div key={`empty-${idx}`} className="min-h-[108px] bg-muted/20" />;
              }

              const isToday = cell.dateKey === todayKey;
              const isOutside = cell.outside === true;
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;
              const isWeekOff = !isOutside && isWeekOffDate(cell.dateKey, weekOffDays);

              const display = isOutside
                ? { kind: "none" as const, statusLabel: "", detailLine: "", hoursLine: "" }
                : resolveCalendarDayDisplay({
                    dateKey: cell.dateKey,
                    todayKey,
                    attendance: dayMap.get(cell.dateKey),
                    weekOffDays,
                    holidayMap,
                    leaves,
                  });

              const hasStatus = Boolean(display.statusLabel);
              const detailHref = `/empHistory/${encodeDateKey(cell.dateKey)}`;

              const inner = (
                <div
                  className={cn(
                    "min-h-[108px] bg-card p-2 flex flex-col transition-colors",
                    isOutside && "bg-muted/15 opacity-60",
                    isWeekend && !isOutside && "bg-muted/10",
                    isWeekOff && !isOutside && "bg-amber-50/30",
                    hasStatus && !isOutside && "border-l-[3px]",
                    hasStatus && !isOutside && kindAccent[display.kind],
                    !isOutside && hasStatus && "hover:bg-muted/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                        isToday
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : isOutside
                            ? "text-muted-foreground"
                            : "text-foreground",
                      )}
                    >
                      {cell.day}
                    </span>
                    {hasStatus && !isOutside ? (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", kindBadge[display.kind])}>
                        {display.statusLabel}
                      </span>
                    ) : null}
                  </div>

                  {hasStatus && !isOutside ? (
                    <div className="mt-2 flex-1 space-y-1 min-w-0">
                      {display.detailLine ? (
                        <p className="text-[10px] leading-snug text-muted-foreground line-clamp-2" title={display.detailLine}>
                          {display.detailLine}
                        </p>
                      ) : null}
                      {display.hoursLine ? (
                        <p className="text-[11px] font-semibold text-emerald-700">{display.hoursLine}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
              );

              if (isOutside || !hasStatus || display.kind === "none") {
                return <div key={cell.dateKey}>{inner}</div>;
              }

              return (
                <Link key={cell.dateKey} href={detailHref} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                  {inner}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </EmpDesktopPage>
  );
}
