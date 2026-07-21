"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
  groupAttendanceByDay,
  formatPunchTime,
  type AttendanceDaySummary,
  type AttendanceLocationRecord,
} from "../../../utils/empAttendanceHistory";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type RegularizationRow = {
  attendanceDate?: string;
  status?: string;
  requestedStatus?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthRange(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(last)}`,
  };
}

function fullDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

function dayName(dateKey: string) {
  return new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function isWeekend(dateKey: string) {
  const dow = new Date(dateKey + "T12:00:00Z").getUTCDay();
  return dow === 0 || dow === 6;
}

function statusMeta(day: AttendanceDaySummary | null, dateKey: string) {
  if (!day?.checkIn) {
    if (isWeekend(dateKey)) return { label: "Weekend", tone: "bg-amber-100 text-amber-800" };
    return { label: "Absent", tone: "bg-rose-100 text-rose-700" };
  }
  if (day.checkIn && day.checkOut) return { label: "Present", tone: "bg-emerald-100 text-emerald-800" };
  return { label: "Partial", tone: "bg-amber-100 text-amber-800" };
}

function PunchTimeline({ records }: { records: AttendanceLocationRecord[] }) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
  );
  const checkIns = sorted.filter((r) => r.checkType === "CHECK_IN");
  const checkOuts = sorted.filter((r) => r.checkType === "CHECK_OUT");

  if (checkIns.length === 0 && checkOuts.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const PunchMarker = ({ time, color }: { time: string; color: string }) => (
    <div className="relative flex h-10 w-14 shrink-0 items-center justify-center">
      <span className="absolute top-0 text-[9px] font-medium tabular-nums text-muted-foreground leading-none">
        {time}
      </span>
      <span
        className={cn(
          "absolute top-1/2 size-2 -translate-y-1/2 rounded-full ring-2 ring-background z-10",
          color,
        )}
      />
    </div>
  );

  return (
    <div className="relative flex min-w-[220px] h-10 items-center px-1">
      <div className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-border z-0" />
      <div className="relative z-[1] flex flex-1 items-center justify-start gap-2 pl-1">
        {checkIns.map((r, i) => (
          <PunchMarker key={`in-${i}`} time={formatPunchTime(r.checkinTime)} color="bg-emerald-500" />
        ))}
      </div>
      <div className="relative z-[1] flex flex-1 items-center justify-end gap-2 pr-1">
        {checkOuts.map((r, i) => (
          <PunchMarker key={`out-${i}`} time={formatPunchTime(r.checkinTime)} color="bg-blue-500" />
        ))}
      </div>
    </div>
  );
}

async function resolveWorkShiftName(
  emp: Record<string, unknown> | null,
  headers: Record<string, string>,
): Promise<string> {
  if (!emp) return "—";

  const promotion = Array.isArray(emp.empPromotion) ? emp.empPromotion[0] : null;
  const empShift = Array.isArray(emp.empWorkShift) ? emp.empWorkShift[0] : null;

  const direct =
    (empShift as { workShift?: { workShiftName?: string } })?.workShift?.workShiftName ||
    (emp.workShift as { workShiftName?: string } | undefined)?.workShiftName ||
    (promotion as { workShift?: { workShiftName?: string } })?.workShift?.workShiftName;

  if (direct) return direct;

  const workShiftID =
    (empShift as { workShiftID?: number; workShift?: { id?: number } })?.workShiftID ??
    (empShift as { workShift?: { id?: number } })?.workShift?.id ??
    (emp.workShiftID as number | undefined) ??
    (promotion as { workShiftID?: number })?.workShiftID;

  if (workShiftID) {
    try {
      const wsRes = await fetch(`${BACKEND}/work-shift/${workShiftID}`, { headers, cache: "no-store" });
      if (wsRes.ok) {
        const ws = await wsRes.json();
        if (ws?.workShiftName) return ws.workShiftName;
      }
    } catch {
      /* ignore */
    }
  }

  return "—";
}

export function EmpProfileAttendanceView({ employeeId: viewEmployeeId }: { employeeId?: number } = {}) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [dayMap, setDayMap] = useState<Map<string, AttendanceDaySummary>>(new Map());
  const [regularizedDates, setRegularizedDates] = useState<Set<string>>(new Set());
  const [workShiftName, setWorkShiftName] = useState<string>("—");
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const monthInputRef = useRef<HTMLInputElement>(null);

  const loadMonth = useCallback(async (year: number, month: number) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
        : "";
    if (!token) return;
    setLoading(true);
    const { from, to } = monthRange(year, month);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      let empId = viewEmployeeId ?? employeeId;
      if (!empId) {
        const userRaw = localStorage.getItem("user");
        if (userRaw) {
          const user = JSON.parse(userRaw);
          empId = user?.employee?.id ?? null;
          if (empId) setEmployeeId(empId);
        }
      } else {
        setEmployeeId(empId);
      }

      const attUrl = viewEmployeeId
        ? `${BACKEND}/emp-manager-scope/member/${viewEmployeeId}/attendance-history?from=${from}&to=${to}`
        : `${BACKEND}/emp-location-attendance/my?from=${from}&to=${to}`;

      const [attRes, regRes, empRes] = await Promise.all([
        fetch(attUrl, { headers, cache: "no-store" }),
        fetch(`${BACKEND}/emp-attendance-regularise`, { headers, cache: "no-store" }),
        empId
          ? fetch(`${BACKEND}/manage-emp/${empId}`, { headers, cache: "no-store" })
          : Promise.resolve(null),
      ]);

      if (attRes.ok) {
        const data = await attRes.json();
        let records: AttendanceLocationRecord[] = [];
        if (Array.isArray(data)) {
          records = data;
        } else if (Array.isArray(data?.records)) {
          records = data.records;
        }
        const grouped = groupAttendanceByDay(records);
        setDayMap(new Map(grouped.map((d) => [d.dateKey, d])));
      } else {
        setDayMap(new Map());
      }

      if (regRes.ok) {
        const regs: RegularizationRow[] = await regRes.json();
        const approved = new Set<string>();
        (Array.isArray(regs) ? regs : []).forEach((r) => {
          if (!r.attendanceDate || !empId) return;
          if (Number((r as { manageEmployeeID?: number }).manageEmployeeID) !== Number(empId)) return;
          const status = String(r.status || "").toLowerCase();
          if (status === "approved" || status === "regularized") {
            approved.add(r.attendanceDate.slice(0, 10));
          }
        });
        setRegularizedDates(approved);
      } else {
        setRegularizedDates(new Set());
      }

      if (empRes && "ok" in empRes && empRes.ok) {
        const emp = await empRes.json();
        setWorkShiftName(await resolveWorkShiftName(emp, headers));
      }
    } catch {
      setDayMap(new Map());
      setRegularizedDates(new Set());
    } finally {
      setLoading(false);
    }
  }, [employeeId, viewEmployeeId]);

  useEffect(() => {
    void loadMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, loadMonth]);

  const monthLabel = new Date(viewYear, viewMonth - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const monthRows = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const rows: { dateKey: string; day: AttendanceDaySummary | null }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${viewYear}-${pad2(viewMonth)}-${pad2(d)}`;
      if (dateKey > todayKey) continue;
      rows.push({ dateKey, day: dayMap.get(dateKey) ?? null });
    }
    return rows.reverse();
  }, [viewYear, viewMonth, dayMap, todayKey]);

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let weekend = 0;
    let totalHours = 0;
    monthRows.forEach(({ dateKey, day }) => {
      if (isWeekend(dateKey)) weekend++;
      if (day?.checkIn && day.checkOut) {
        present++;
        totalHours += day.workSeconds;
      } else if (!isWeekend(dateKey) && !day?.checkIn) {
        absent++;
      }
    });
    const hours = Math.floor(totalHours / 3600);
    const mins = Math.floor((totalHours % 3600) / 60);
    return { present, absent, weekend, hoursLabel: `${hours}h ${mins}m` };
  }, [monthRows]);

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
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Days present", value: summary.present, sub: "This month" },
          { label: "Hours worked", value: summary.hoursLabel, sub: "Logged time" },
          {
            label: "Monthly attendance",
            value: `${monthRows.length ? Math.round((summary.present / monthRows.length) * 100) : 0}%`,
            sub: "Present rate",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold tabular-nums text-foreground mt-0.5">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
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
            <h3 className="text-sm font-semibold text-foreground">{monthLabel}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                const d = new Date(viewYear, viewMonth - 2, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth() + 1);
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                const d = new Date(viewYear, viewMonth, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth() + 1);
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-border bg-muted/20 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Present {summary.present}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            Absent {summary.absent}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            Weekend {summary.weekend}
          </span>
          <span className="inline-flex items-center gap-1.5 ml-auto text-muted-foreground">
            <Clock className="size-3.5" />
            {summary.hoursLabel} total
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading attendance…</div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-primary/5 text-left">
                    <th className="px-4 py-2.5 font-semibold text-foreground w-[100px]">Date</th>
                    <th className="px-4 py-2.5 font-semibold text-foreground w-[70px]">Day</th>
                    <th className="px-4 py-2.5 font-semibold text-foreground min-w-[240px]">In / Out</th>
                    <th className="px-4 py-2.5 font-semibold text-foreground w-[90px]">Hours</th>
                    <th className="px-4 py-2.5 font-semibold text-foreground w-[110px]">Work shift</th>
                    <th className="px-4 py-2.5 font-semibold text-foreground w-[100px]">Regularize</th>
                    <th className="px-4 py-2.5 font-semibold text-foreground w-[100px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map(({ dateKey, day }) => {
                    const meta = statusMeta(day, dateKey);
                    const weekend = isWeekend(dateKey);
                    const isRegularized = regularizedDates.has(dateKey);
                    return (
                      <tr
                        key={dateKey}
                        className={cn(
                          "border-b border-border last:border-0",
                          weekend && "bg-muted/40",
                          dateKey === todayKey && "bg-primary/5",
                        )}
                      >
                        <td className="px-4 py-2.5 font-medium tabular-nums">{fullDateLabel(dateKey)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{dayName(dateKey)}</td>
                        <td className="px-4 py-2">
                          {day?.records?.length ? (
                            <PunchTimeline records={day.records} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums font-medium">{day?.workLabel ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs">{workShiftName}</td>
                        <td className="px-4 py-2.5">
                          {isRegularized ? (
                            <Badge className="text-[10px] font-semibold border-0 bg-violet-100 text-violet-800">
                              Regularized
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className={cn("text-[10px] font-semibold border-0", meta.tone)}>{meta.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-border">
              {monthRows.map(({ dateKey, day }) => {
                const meta = statusMeta(day, dateKey);
                const isRegularized = regularizedDates.has(dateKey);
                return (
                  <div key={dateKey} className={cn("px-4 py-3", isWeekend(dateKey) && "bg-muted/30")}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold tabular-nums">
                          {fullDateLabel(dateKey)} · {dayName(dateKey)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {day?.workLabel ?? "0h"} · {workShiftName}
                          {isRegularized ? " · Regularized" : ""}
                        </p>
                      </div>
                      <Badge className={cn("text-[10px] border-0", meta.tone)}>{meta.label}</Badge>
                    </div>
                    {day?.records?.length ? (
                      <div className="mt-2">
                        <PunchTimeline records={day.records} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
