"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Calendar, CheckSquare, ChevronLeft, ChevronRight, Clock, ListTodo, MapPin } from "lucide-react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import {
  EmpCalendarDayDetailPanel,
  type CalendarDayDetailSection,
} from "./EmpCalendarDayDetailPanel";
import { Button } from "../../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../ui/sheet";
import {
  groupAttendanceByDay,
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
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { taskFetch } from "@/app/utils/taskApi";
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

function taskDateKey(scheduleDateTime: string) {
  const d = new Date(scheduleDateTime);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function memoDateKey(iso: string) {
  return iso.slice(0, 10);
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
    cells.push({ dateKey: `${py}-${pad2(pm)}-${pad2(day)}`, day, outside: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateKey: `${year}-${pad2(month)}-${pad2(d)}`, day: d });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    cells.push({ dateKey: `${ny}-${pad2(nm)}-${pad2(d)}`, day: d, outside: true });
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

const DAY_DETAIL_TABS: {
  id: CalendarDayDetailSection;
  label: string;
  icon: typeof Clock;
}[] = [
  { id: "punches", label: "Attendance punches", icon: Clock },
  { id: "sites", label: "Site visits", icon: MapPin },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "todo", label: "ToDo", icon: CheckSquare },
];

export function EmpDesktopWorkspaceCalendar() {
  const user = useCurrentUser();
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
  const [tasksByDate, setTasksByDate] = useState<Map<string, number>>(new Map());
  const [noticesByDate, setNoticesByDate] = useState<Map<string, number>>(new Map());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dayDetailSection, setDayDetailSection] = useState<CalendarDayDetailSection>("punches");
  const monthInputRef = useRef<HTMLInputElement>(null);

  const todayKey = todayPunchDateKey();

  const loadMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    const { from, to } = monthRange(year, month);
    try {
      const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const parsedUser = userRaw ? JSON.parse(userRaw) : null;
      const empId = parsedUser?.employee?.id;

      const [attendanceData, holidaysData, leaveData, empData, memoData] = await Promise.all([
        fetch(`${BACKEND}/emp-location-attendance/my?from=${from}&to=${to}`, {
          headers: authHeaders(),
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${BACKEND}/emp-notifications/holidays`, { headers: authHeaders(), cache: "no-store" }).then((r) =>
          r.ok ? r.json() : [],
        ),
        empId != null
          ? fetch(`${BACKEND}/leave-application/employee/${empId}`, { headers: authHeaders(), cache: "no-store" }).then(
              (r) => (r.ok ? r.json() : []),
            )
          : Promise.resolve([]),
        empId != null
          ? fetch(`${BACKEND}/manage-emp/${empId}`, { headers: authHeaders(), cache: "no-store" }).then((r) =>
              r.ok ? r.json() : null,
            )
          : Promise.resolve(null),
        empId != null
          ? fetch(`${BACKEND}/employee-memo`, { headers: authHeaders(), cache: "no-store" }).then((r) =>
              r.ok ? r.json() : [],
            )
          : Promise.resolve([]),
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

      const noticeMap = new Map<string, number>();
      (Array.isArray(memoData) ? memoData : []).forEach(
        (m: { employeeID?: number; employeeIDs?: number[]; undoneAt?: string | null; createdAt?: string; issuedDate?: string }) => {
          if (m.undoneAt || !empId) return;
          const mine =
            m.employeeID === empId || (Array.isArray(m.employeeIDs) && m.employeeIDs.includes(empId));
          if (!mine) return;
          const key = memoDateKey(m.issuedDate || m.createdAt || "");
          if (!key || key.length < 10) return;
          noticeMap.set(key, (noticeMap.get(key) ?? 0) + 1);
        },
      );
      setNoticesByDate(noticeMap);

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

      if (user) {
        try {
          const taskData = await taskFetch<{ items: { scheduleDateTime?: string | null }[] }>(
            "/task-projects",
            user,
            undefined,
            { limit: 200 },
          );
          const taskMap = new Map<string, number>();
          (taskData.items || []).forEach((t) => {
            if (!t.scheduleDateTime) return;
            const key = taskDateKey(t.scheduleDateTime);
            if (!key) return;
            taskMap.set(key, (taskMap.get(key) ?? 0) + 1);
          });
          setTasksByDate(taskMap);
        } catch {
          setTasksByDate(new Map());
        }
      }
    } catch {
      setDays([]);
      setHolidayMap(new Map());
      setLeaves([]);
      setWeekOffDays(new Set());
      setTasksByDate(new Map());
      setNoticesByDate(new Map());
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  const openMonthPicker = () => {
    const el = monthInputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.click();
  };

  return (
    <EmpDesktopPage
      title="My Calendar"
      description="Attendance, tasks, notices, holidays, and week offs"
      icon={Calendar}
      className="!space-y-0 h-[calc(100dvh-8.75rem)] max-h-[calc(100dvh-8.75rem)] overflow-hidden"
    >
      {selectedDateKey ? (
        <Sheet
          open={!!selectedDateKey}
          onOpenChange={(open) => {
            if (!open) setSelectedDateKey(null);
          }}
        >
          <SheetContent
            side="right"
            overlayClassName="bg-background/30 backdrop-blur-[1px]"
            className="w-full sm:max-w-xl overflow-y-auto p-0"
          >
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border text-left space-y-4">
              <div>
                <SheetTitle>Day details</SheetTitle>
                <SheetDescription>{selectedDateKey}</SheetDescription>
              </div>
              <div
                className="inline-flex w-full rounded-lg border border-border/80 bg-muted/30 p-1"
                role="tablist"
                aria-label="Day detail sections"
              >
                {DAY_DETAIL_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = dayDetailSection === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setDayDetailSection(tab.id)}
                      className={cn(
                        "relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] sm:text-xs font-medium transition-all",
                        active
                          ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-3.5 shrink-0 sm:size-4", active ? "text-primary" : "opacity-70")} />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </SheetHeader>
            <div className="px-2 pb-6">
              <EmpCalendarDayDetailPanel dateKey={selectedDateKey} section={dayDetailSection} />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-muted/40 to-card px-5 py-3">
          <div className="flex items-center gap-2">
            <input
              ref={monthInputRef}
              type="month"
              value={`${viewYear}-${pad2(viewMonth)}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                if (y && m) {
                  setViewYear(y);
                  setViewMonth(m);
                }
              }}
              className="sr-only"
              aria-hidden
              tabIndex={-1}
            />
            <Button type="button" variant="outline" size="icon" className="size-8" onClick={openMonthPicker} aria-label="Select month">
              <Calendar className="size-4" />
            </Button>
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

        <div className="grid shrink-0 grid-cols-7 border-b border-border bg-muted/30">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn(
                "py-2 text-center text-[11px] font-semibold uppercase tracking-wide",
                i === 0 || i === 6 ? "text-muted-foreground/70" : "text-muted-foreground",
              )}
            >
              {w}
            </div>
          ))}
        </div>

        {loading ? (
          <div
            className="grid min-h-0 flex-1 grid-cols-7 gap-px bg-border p-px"
            style={{ gridTemplateRows: "repeat(5, minmax(0, 1fr))" }}
          >
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-full min-h-0 bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div
            className="grid min-h-0 flex-1 grid-cols-7 gap-px bg-border"
            style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(cells.length / 7))}, minmax(0, 1fr))` }}
          >
            {cells.map((cell, idx) => {
              if (!cell.dateKey || cell.day == null) {
                return <div key={`empty-${idx}`} className="h-full min-h-0 bg-muted/20" />;
              }

              const isToday = cell.dateKey === todayKey;
              const isOutside = cell.outside === true;
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;
              const isWeekOff = !isOutside && isWeekOffDate(cell.dateKey, weekOffDays);
              const taskCount = tasksByDate.get(cell.dateKey) ?? 0;
              const noticeCount = noticesByDate.get(cell.dateKey) ?? 0;
              const isHoliday = !isOutside && holidayMap.has(cell.dateKey);

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
              const hasIcons = taskCount > 0 || noticeCount > 0 || isHoliday || isWeekOff;
              const clickable = !isOutside && (hasStatus || hasIcons || true);

              const inner = (
                <div
                  className={cn(
                    "flex h-full min-h-0 w-full flex-col overflow-hidden bg-card p-1.5 text-left transition-colors",
                    isOutside && "bg-muted/15 opacity-60",
                    isWeekend && !isOutside && "bg-muted/10",
                    isWeekOff && !isOutside && "bg-amber-50/30",
                    hasStatus && !isOutside && "border-l-[3px]",
                    hasStatus && !isOutside && kindAccent[display.kind],
                    clickable && !isOutside && "hover:bg-muted/20 cursor-pointer",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold sm:size-7 sm:text-sm",
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

                  {!isOutside ? (
                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                      {taskCount > 0 ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-800" title={`${taskCount} task(s)`}>
                          <ListTodo className="size-3" />
                          {taskCount > 1 ? taskCount : null}
                        </span>
                      ) : null}
                      {noticeCount > 0 ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800" title={`${noticeCount} notice(s)`}>
                          <Bell className="size-3" />
                          {noticeCount > 1 ? noticeCount : null}
                        </span>
                      ) : null}
                      {isHoliday ? (
                        <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700" title={holidayMap.get(cell.dateKey)}>
                          Hol
                        </span>
                      ) : null}
                      {isWeekOff ? (
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                          Off
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}

                  {hasStatus && !isOutside ? (
                    <div className="mt-0.5 min-w-0 space-y-0.5">
                      {display.detailLine ? (
                        <p className="line-clamp-1 text-[10px] leading-snug text-muted-foreground" title={display.detailLine}>
                          {display.detailLine}
                        </p>
                      ) : null}
                      {display.hoursLine ? (
                        <p className="text-[10px] font-semibold text-emerald-700">{display.hoursLine}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );

              if (!clickable) {
                return <div key={cell.dateKey} className="h-full min-h-0">{inner}</div>;
              }

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => {
                    setDayDetailSection("punches");
                    setSelectedDateKey(cell.dateKey);
                  }}
                  className="block h-full min-h-0 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {inner}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </EmpDesktopPage>
  );
}
