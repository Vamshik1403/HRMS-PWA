"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, CheckSquare, Clock, ListTodo, MapPin } from "lucide-react";
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
import { buildWeekOffDayNames, type WorkShiftDayRow } from "../../../utils/empWorkShiftWeekOff";
import type { EmpHolidayRow } from "../EmpHolidayListMobile";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { taskFetch } from "@/app/utils/taskApi";
import { cn } from "@/app/utils/cn";
import { todoTextsByDate } from "@/app/utils/empCalendarTodos";
import { canViewProductModule, useProductAccess } from "@/lib/productAccess";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarViewMode = "month" | "week" | "day";

const LEGEND: { label: string; swatch: string }[] = [
  { label: "Present", swatch: "bg-emerald-100 border border-emerald-300" },
  { label: "Absent", swatch: "bg-rose-100 border border-rose-300" },
  { label: "Leave", swatch: "bg-sky-100 border border-sky-300" },
  { label: "Week off", swatch: "bg-amber-100 border border-amber-300" },
  { label: "Public holiday", swatch: "bg-violet-500" },
  { label: "Task", swatch: "bg-sky-500" },
  { label: "ToDo", swatch: "bg-teal-500" },
];

const ATTENDANCE_CHIP: Record<
  Exclude<CalendarDayKind, "none" | "holiday">,
  { label: string; className: string }
> = {
  present: {
    label: "Present",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  absent: {
    label: "Absent",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
  leave: {
    label: "Leave",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  weekoff: {
    label: "Week off",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
};

const VIEW_MODES: { id: CalendarViewMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
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

function parseDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateKey(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
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

function buildWeekCells(anchorKey: string) {
  const anchor = parseDateKey(anchorKey);
  const dow = anchor.getUTCDay();
  const start = new Date(anchor);
  start.setUTCDate(anchor.getUTCDate() - dow);
  const cells: { dateKey: string; day: number; outside?: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push({
      dateKey: toDateKey(d),
      day: d.getUTCDate(),
      outside: d.getUTCMonth() !== anchor.getUTCMonth(),
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

const DAY_DETAIL_TABS: {
  id: Exclude<CalendarDayDetailSection, "all">;
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
  useProductAccess();
  const showTaskSections =
    canViewProductModule("TASK_MODULE") || canViewProductModule("ONFIELD_TASK_MODULE");
  const dayDetailTabs = DAY_DETAIL_TABS.filter(
    (tab) => showTaskSections || (tab.id !== "sites" && tab.id !== "tasks"),
  );
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [focusDateKey, setFocusDateKey] = useState(todayPunchDateKey());
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<AttendanceDaySummary[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<Set<string>>(new Set());
  const [holidayMap, setHolidayMap] = useState<Map<string, string>>(new Map());
  const [leaves, setLeaves] = useState<
    { fromDate?: string; toDate?: string; status?: string; appliedLeaveType?: string; dayStatuses?: unknown }[]
  >([]);
  const [tasksByDate, setTasksByDate] = useState<Map<string, string[]>>(new Map());
  const [todosByDate, setTodosByDate] = useState<Map<string, string[]>>(new Map());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dayDetailSection, setDayDetailSection] = useState<Exclude<CalendarDayDetailSection, "all">>("punches");
  const monthInputRef = useRef<HTMLInputElement>(null);

  const todayKey = todayPunchDateKey();

  useEffect(() => {
    if (!showTaskSections && (dayDetailSection === "sites" || dayDetailSection === "tasks")) {
      setDayDetailSection("punches");
    }
  }, [dayDetailSection, showTaskSections]);

  const refreshTodosByDate = useCallback(() => {
    const empId = Number(user?.employee?.id ?? 0) || 0;
    setTodosByDate(empId ? todoTextsByDate(empId) : new Map());
  }, [user?.employee?.id]);

  useEffect(() => {
    refreshTodosByDate();
    const onChange = () => refreshTodosByDate();
    window.addEventListener("emp-calendar-todos-changed", onChange);
    return () => window.removeEventListener("emp-calendar-todos-changed", onChange);
  }, [refreshTodosByDate]);

  const loadMonth = useCallback(
    async (year: number, month: number) => {
      setLoading(true);
      const { from, to } = monthRange(year, month);
      try {
        const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
        const parsedUser = userRaw ? JSON.parse(userRaw) : null;
        const empId = parsedUser?.employee?.id;

        const [attendanceData, holidaysData, leaveData, empData] = await Promise.all([
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

        if (user) {
          try {
            const taskData = await taskFetch<{
              items: { scheduleDateTime?: string | null; taskName?: string | null }[];
            }>("/task-projects", user, undefined, { limit: 200, assignedToMe: 1 });
            const taskMap = new Map<string, string[]>();
            (taskData.items || []).forEach((t) => {
              if (!t.scheduleDateTime) return;
              const key = taskDateKey(t.scheduleDateTime);
              if (!key) return;
              const name = String(t.taskName || "Task").trim() || "Task";
              const list = taskMap.get(key) ?? [];
              list.push(name);
              taskMap.set(key, list);
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
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void loadMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, loadMonth]);

  const dayMap = useMemo(() => new Map(days.map((d) => [d.dateKey, d])), [days]);
  const monthCells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const weekCells = useMemo(() => buildWeekCells(focusDateKey), [focusDateKey]);

  const headerLabel = useMemo(() => {
    if (viewMode === "day") {
      return parseDateKey(focusDateKey).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    if (viewMode === "week") {
      const start = weekCells[0]?.dateKey;
      const end = weekCells[6]?.dateKey;
      if (!start || !end) return "Week";
      const a = parseDateKey(start).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
      const b = parseDateKey(end).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      return `${a} – ${b}`;
    }
    return new Date(Date.UTC(viewYear, viewMonth - 1, 1)).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [viewMode, focusDateKey, weekCells, viewYear, viewMonth]);

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

  const openDaySheet = (dateKey: string, section: Exclude<CalendarDayDetailSection, "all"> = "punches") => {
    setFocusDateKey(dateKey);
    setDayDetailSection(section);
    setSelectedDateKey(dateKey);
  };

  const renderDayCell = (
    cell: { dateKey: string; day: number; outside?: boolean },
    _idx: number,
    compact: boolean,
  ) => {
    const isToday = cell.dateKey === todayKey;
    const isOutside = cell.outside === true;
    const taskNames = tasksByDate.get(cell.dateKey) ?? [];
    const todoTexts = todosByDate.get(cell.dateKey) ?? [];
    const holidayName = !isOutside ? holidayMap.get(cell.dateKey) : undefined;
    const display = isOutside
      ? null
      : resolveCalendarDayDisplay({
          dateKey: cell.dateKey,
          todayKey,
          attendance: dayMap.get(cell.dateKey),
          weekOffDays,
          holidayMap,
          leaves,
        });
    const badgeKind = display?.kind ?? "none";
    const attendanceChip =
      badgeKind === "present" || badgeKind === "absent" || badgeKind === "leave" || badgeKind === "weekoff"
        ? ATTENDANCE_CHIP[badgeKind]
        : null;
    const clickable = !isOutside;

    const eventRows: {
      key: string;
      label: string;
      className: string;
      onActivate?: () => void;
    }[] = [];
    if (holidayName) {
      eventRows.push({
        key: `holiday-${cell.dateKey}`,
        label: holidayName || "Public holiday",
        className: "bg-violet-500 text-white",
      });
    }
    taskNames.forEach((name, i) => {
      eventRows.push({
        key: `task-${cell.dateKey}-${i}`,
        label: name,
        className: "bg-sky-500 text-white",
      });
    });
    todoTexts.forEach((text, i) => {
      eventRows.push({
        key: `todo-${cell.dateKey}-${i}`,
        label: text,
        className: "bg-teal-500 text-white",
        onActivate: () => {
          if (viewMode === "day") {
            setFocusDateKey(cell.dateKey);
            return;
          }
          openDaySheet(cell.dateKey, "todo");
        },
      });
    });

    const inner = (
      <div
        className={cn(
          "flex h-full min-h-0 w-full flex-col overflow-hidden bg-card p-1.5 text-left transition-colors",
          clickable && "hover:bg-muted/10 cursor-pointer",
          compact && "min-h-[88px]",
        )}
      >
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center self-start rounded-full text-xs font-semibold sm:size-7 sm:text-sm",
            isToday
              ? "bg-primary text-primary-foreground shadow-sm"
              : isOutside
                ? "text-muted-foreground/70"
                : "text-foreground",
          )}
        >
          {cell.day}
        </span>

        {!isOutside ? (
          <div
            className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            {attendanceChip ? (
              <div
                className={cn(
                  "w-full shrink-0 rounded border px-1 py-0.5 text-center leading-tight",
                  attendanceChip.className,
                )}
              >
                <div className="truncate text-[10px] font-semibold">{attendanceChip.label}</div>
                {badgeKind === "present" && display?.hoursLine ? (
                  <div className="truncate text-[9px] font-medium opacity-80">{display.hoursLine}</div>
                ) : null}
              </div>
            ) : null}
            {eventRows.map((row) => (
              <div
                key={row.key}
                title={row.label}
                role={row.onActivate ? "button" : undefined}
                tabIndex={row.onActivate ? 0 : undefined}
                className={cn(
                  "w-full shrink-0 truncate rounded-sm px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight",
                  row.className,
                  row.onActivate && "hover:brightness-95",
                )}
                onClick={
                  row.onActivate
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        row.onActivate?.();
                      }
                    : undefined
                }
                onKeyDown={
                  row.onActivate
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          row.onActivate?.();
                        }
                      }
                    : undefined
                }
              >
                {row.label}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    );

    if (!clickable) {
      return (
        <div key={cell.dateKey} className="h-full min-h-0 bg-card">
          {inner}
        </div>
      );
    }

    return (
      <div
        key={cell.dateKey}
        role="button"
        tabIndex={0}
        onClick={() => {
          setFocusDateKey(cell.dateKey);
          if (viewMode === "day") return;
          if (viewMode === "week") {
            setViewMode("day");
            return;
          }
          openDaySheet(cell.dateKey, "punches");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFocusDateKey(cell.dateKey);
            if (viewMode === "month") openDaySheet(cell.dateKey, "punches");
            if (viewMode === "week") setViewMode("day");
          }
        }}
        className={cn(
          "block h-full min-h-0 w-full bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          cell.dateKey === focusDateKey && viewMode !== "month" && "ring-1 ring-primary/40",
        )}
      >
        {inner}
      </div>
    );
  };

  return (
    <EmpDesktopPage
      title="My Calendar"
      description="Attendance, tasks, holidays, and week offs"
      icon={Calendar}
      className="!space-y-0 h-[calc(100dvh-8.75rem)] max-h-[calc(100dvh-8.75rem)] overflow-hidden"
    >
      {selectedDateKey && viewMode === "month" ? (
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
                {dayDetailTabs.map((tab) => {
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
                  setFocusDateKey(`${y}-${pad2(m)}-01`);
                }
              }}
              className="sr-only"
              aria-hidden
              tabIndex={-1}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={openMonthPicker}
              aria-label="Select month"
            >
              <Calendar className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-3 text-xs"
              onClick={() => {
                setFocusDateKey(todayKey);
                const [y, m] = todayKey.split("-").map(Number);
                setViewYear(y);
                setViewMonth(m);
              }}
            >
              Today
            </Button>
            <h2 className="ml-1 text-lg font-semibold text-foreground">{headerLabel}</h2>
          </div>

          <div className="inline-flex rounded-lg border border-border/80 bg-muted/30 p-1" role="tablist">
            {VIEW_MODES.map((mode) => {
              const active = viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setViewMode(mode.id);
                    if (mode.id === "day" && !focusDateKey) setFocusDateKey(todayKey);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {viewMode !== "day" ? (
          <div className="grid shrink-0 grid-cols-7 border-b border-border bg-card">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {w}
              </div>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : viewMode === "day" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <EmpCalendarDayDetailPanel dateKey={focusDateKey} section="all" />
          </div>
        ) : viewMode === "week" ? (
          <div className="grid min-h-0 flex-1 grid-cols-7 gap-px bg-border">
            {weekCells.map((cell, idx) => renderDayCell(cell, idx, true))}
          </div>
        ) : (
          <div
            className="grid min-h-0 flex-1 grid-cols-7 gap-px bg-border"
            style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(monthCells.length / 7))}, minmax(0, 1fr))` }}
          >
            {monthCells.map((cell, idx) => {
              if (!cell.dateKey || cell.day == null) {
                return <div key={`empty-${idx}`} className="h-full min-h-0 bg-card" />;
              }
              return renderDayCell(
                { dateKey: cell.dateKey, day: cell.day, outside: cell.outside },
                idx,
                false,
              );
            })}
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center gap-4 border-t border-border px-5 py-3">
          {LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("size-2.5 shrink-0 rounded-sm", item.swatch)} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </EmpDesktopPage>
  );
}
