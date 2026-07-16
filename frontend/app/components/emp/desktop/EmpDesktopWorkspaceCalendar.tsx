"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { Button } from "../../ui/button";
import {
  groupAttendanceByDay,
  type AttendanceDaySummary,
  type AttendanceLocationRecord,
} from "../../../utils/empAttendanceHistory";
import { todayPunchDateKey } from "../../../utils/attendanceDuration";
import {
  expandHolidayDateMap,
  resolveCalendarDayDisplay,
} from "../../../utils/empCalendarDayStatus";
import { buildWeekOffDayNames, isWeekOffDate, type WorkShiftDayRow } from "../../../utils/empWorkShiftWeekOff";
import type { EmpHolidayRow } from "../EmpHolidayListMobile";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const cells: { dateKey: string | null; day: number | null }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ dateKey: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateKey: `${year}-${pad2(month)}-${pad2(d)}`, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ dateKey: null, day: null });
  return cells;
}

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const statusToneClass: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700",
  absent: "bg-rose-50 text-rose-700",
  holiday: "bg-violet-50 text-violet-700",
  weekoff: "bg-amber-50 text-amber-800",
  leave: "bg-sky-50 text-sky-700",
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

      const attendancePromise = fetch(`${BACKEND}/emp-location-attendance/my?from=${from}&to=${to}`, {
        headers: authHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : []));

      const holidaysPromise = fetch(`${BACKEND}/emp-notifications/holidays`, {
        headers: authHeaders(),
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : []));

      const leavePromise =
        empId != null
          ? fetch(`${BACKEND}/leave-application/employee/${empId}`, {
              headers: authHeaders(),
              cache: "no-store",
            }).then((r) => (r.ok ? r.json() : []))
          : Promise.resolve([]);

      const empPromise =
        empId != null
          ? fetch(`${BACKEND}/manage-emp/${empId}`, { headers: authHeaders(), cache: "no-store" }).then((r) =>
              r.ok ? r.json() : null,
            )
          : Promise.resolve(null);

      const [attendanceData, holidaysData, leaveData, empData] = await Promise.all([
        attendancePromise,
        holidaysPromise,
        leavePromise,
        empPromise,
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
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
          <Button type="button" variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Calendar className="size-4 text-primary" />
            {monthLabel}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-muted/20">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase">
              {w}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading calendar…</div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              if (!cell.dateKey || cell.day == null) {
                return <div key={`empty-${idx}`} className="min-h-[110px] border-b border-r border-border/60 bg-muted/10" />;
              }
              const isToday = cell.dateKey === todayKey;
              const isWeekOff = isWeekOffDate(cell.dateKey, weekOffDays);

              const display = resolveCalendarDayDisplay({
                dateKey: cell.dateKey,
                todayKey,
                attendance: dayMap.get(cell.dateKey),
                weekOffDays,
                holidayMap,
                leaves,
              });

              return (
                <div
                  key={cell.dateKey}
                  className={cn(
                    "min-h-[110px] border-b border-r border-border/60 p-1.5 flex flex-col",
                    isWeekOff ? "bg-amber-50/50" : "bg-card",
                  )}
                >
                  <div className="flex justify-start">
                    <span
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                        isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                      )}
                    >
                      {cell.day}
                    </span>
                  </div>
                  {display.statusLabel ? (
                    <div className="mt-1 space-y-0.5 min-w-0">
                      <span
                        className={cn(
                          "block text-[10px] font-bold leading-tight px-1.5 py-0.5 rounded w-fit",
                          statusToneClass[display.kind] || "bg-muted text-foreground",
                        )}
                      >
                        {display.statusLabel}
                      </span>
                      {display.detailLine ? (
                        <p className="text-[9px] leading-tight text-muted-foreground px-0.5 truncate" title={display.detailLine}>
                          {display.detailLine}
                        </p>
                      ) : null}
                      {display.hoursLine ? (
                        <p className="text-[9px] font-semibold leading-tight text-emerald-700 px-0.5">
                          {display.hoursLine}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </EmpDesktopPage>
  );
}
