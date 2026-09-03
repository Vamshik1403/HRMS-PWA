"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Calendar,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Flag,
  Home,
  MapPin,
  Timer,
} from "lucide-react";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  groupAttendanceByDay,
  formatPunchTime,
  formatLocationLines,
  extractDayPunchTimes,
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

type AttendanceStatusKind =
  | "present"
  | "absent"
  | "weekend"
  | "partial"
  | "leave"
  | "holiday"
  | "wfh";

type AttendanceStatusMeta = {
  kind: AttendanceStatusKind;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
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

function resolveAttendanceStatus(
  day: AttendanceDaySummary | null,
  dateKey: string,
): AttendanceStatusMeta {
  if (isWeekend(dateKey)) {
    return {
      kind: "weekend",
      label: "Weekend",
      icon: CalendarDays,
      iconClassName: "text-[#6B7280]",
    };
  }

  if (!day?.checkIn) {
    return {
      kind: "absent",
      label: "Absent",
      icon: Circle,
      iconClassName: "text-[#9CA3AF] fill-[#9CA3AF]",
    };
  }

  if (day.checkIn && day.checkOut) {
    return {
      kind: "present",
      label: "Present",
      icon: CheckCircle,
      iconClassName: "text-[#16A34A]",
    };
  }

  return {
    kind: "partial",
    label: "Partial",
    icon: Clock3,
    iconClassName: "text-[#9A6700]",
  };
}

function AttendanceStatusCell({ status }: { status: AttendanceStatusMeta }) {
  const Icon = status.icon;
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[#111827]">
      <Icon
        className={cn("size-4 shrink-0", status.iconClassName)}
        strokeWidth={status.kind === "present" ? 1.75 : 2}
        aria-hidden
      />
      <span className="font-normal">{status.label}</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="group rounded-lg border border-[#E5E7EB] bg-white px-6 py-5 transition-colors hover:border-[#D1D5DB] hover:bg-[#FAFAFA]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#6B7280]">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#111827]">
            {value}
            {suffix ? (
              <span className="ml-1 text-sm font-normal text-[#6B7280]">{suffix}</span>
            ) : null}
          </p>
        </div>
        <Icon className="size-4 shrink-0 text-[#9CA3AF] transition-colors group-hover:text-[#6B7280]" strokeWidth={1.75} />
      </div>
    </div>
  );
}

function PunchTimeline({ records }: { records: AttendanceLocationRecord[] }) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
  );
  const checkIns = sorted.filter((r) => r.checkType === "CHECK_IN");
  const checkOuts = sorted.filter((r) => r.checkType === "CHECK_OUT");

  if (checkIns.length === 0 && checkOuts.length === 0) {
    return <span className="text-sm text-[#9CA3AF]">—</span>;
  }

  const firstCheckIn = checkIns[0];
  const lastCheckOut = checkOuts[checkOuts.length - 1];

  const PunchMarker = ({
    time,
    dotClass,
    edge,
  }: {
    time: string;
    dotClass: string;
    edge: "start" | "end";
  }) => (
    <div
      className={cn(
        "absolute top-1/2 z-10 -translate-y-1/2",
        edge === "start" ? "left-0" : "right-0",
      )}
    >
      <div className="relative flex flex-col items-center">
        <span className="absolute bottom-full mb-1 whitespace-nowrap text-[11px] font-medium tabular-nums leading-none text-[#6B7280]">
          {time}
        </span>
        <span className={cn("size-2 rounded-full ring-2 ring-white", dotClass)} />
      </div>
    </div>
  );

  return (
    <div className="relative mx-0 h-11 min-w-[200px]">
      <div className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-[#E5E7EB]" />
      {firstCheckIn ? (
        <PunchMarker
          time={formatPunchTime(firstCheckIn.checkinTime)}
          dotClass="bg-[#16A34A]"
          edge="start"
        />
      ) : null}
      {lastCheckOut ? (
        <PunchMarker
          time={formatPunchTime(lastCheckOut.checkinTime)}
          dotClass="bg-[#111827]"
          edge="end"
        />
      ) : null}
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

function PunchLocationBlock({
  label,
  punch,
}: {
  label: string;
  punch: AttendanceLocationRecord | null;
}) {
  const { address, coordinates } = formatLocationLines(punch);
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className="mt-2 text-lg font-semibold tabular-nums text-[#111827]">
        {punch ? formatPunchTime(punch.checkinTime) : "—"}
      </p>
      <div className="mt-3 flex items-start gap-2 text-sm text-[#374151]">
        <MapPin className="mt-0.5 size-4 shrink-0 text-[#9CA3AF]" strokeWidth={1.75} />
        <div className="min-w-0">
          <p>{address || "Location not recorded"}</p>
          {coordinates ? (
            <p className="mt-1 font-mono text-xs text-[#6B7280]">{coordinates}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
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

  const selectedDay = selectedDateKey ? dayMap.get(selectedDateKey) ?? null : null;
  const selectedPunches = selectedDay?.records?.length
    ? extractDayPunchTimes(selectedDay.records)
    : null;

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let weekend = 0;
    let partial = 0;
    let totalHours = 0;

    monthRows.forEach(({ dateKey, day }) => {
      const status = resolveAttendanceStatus(day, dateKey);
      if (status.kind === "weekend") weekend++;
      else if (status.kind === "present") {
        present++;
        totalHours += day?.workSeconds ?? 0;
      } else if (status.kind === "partial") partial++;
      else if (status.kind === "absent") absent++;
    });

    const workingDays = monthRows.filter(({ dateKey }) => !isWeekend(dateKey)).length;
    const hours = Math.floor(totalHours / 3600);
    const mins = Math.floor((totalHours % 3600) / 60);

    return {
      present,
      absent,
      weekend,
      partial,
      workingDays,
      hoursLabel: `${hours}h ${mins}m`,
    };
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

  const statCards = [
    { label: "Present", value: summary.present, suffix: summary.present === 1 ? "Day" : "Days", icon: CheckCircle },
    { label: "Absent", value: summary.absent, suffix: summary.absent === 1 ? "Day" : "Days", icon: Circle },
    { label: "Weekend", value: summary.weekend, suffix: summary.weekend === 1 ? "Day" : "Days", icon: CalendarDays },
    { label: "Partial", value: summary.partial, suffix: summary.partial === 1 ? "Day" : "Days", icon: Clock3 },
    { label: "Total working days", value: summary.workingDays, suffix: "", icon: Timer },
  ];

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5">
          <div className="flex items-center gap-3">
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 border-[#E5E7EB] bg-white text-[#6B7280] shadow-none hover:bg-[#F9FAFB] hover:text-[#111827]"
              onClick={openMonthPicker}
              aria-label="Select month"
            >
              <Calendar className="size-4" strokeWidth={1.75} />
            </Button>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[#111827]">{monthLabel}</h3>
              <p className="mt-0.5 text-[13px] text-[#6B7280]">{summary.hoursLabel} logged this month</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
              onClick={() => {
                const d = new Date(viewYear, viewMonth - 2, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth() + 1);
              }}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
              onClick={() => {
                const d = new Date(viewYear, viewMonth, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth() + 1);
              }}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        {loading ? (
          <div className="py-20 text-center text-sm text-[#6B7280]">Loading attendance…</div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    {["Date", "Day", "In / Out", "Hours", "Work shift", "Regularize", "Status"].map((header) => (
                      <th
                        key={header}
                        className={cn(
                          "px-6 py-3 text-left text-sm font-medium text-[#6B7280]",
                          header === "In / Out" && "min-w-[220px]",
                          header === "Date" && "w-[108px]",
                          header === "Day" && "w-[72px]",
                          header === "Hours" && "w-[96px]",
                          header === "Work shift" && "w-[120px]",
                          header === "Regularize" && "w-[112px]",
                          header === "Status" && "w-[128px]",
                        )}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map(({ dateKey, day }) => {
                    const status = resolveAttendanceStatus(day, dateKey);
                    const isRegularized = regularizedDates.has(dateKey);
                    return (
                      <tr
                        key={dateKey}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDateKey(dateKey)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedDateKey(dateKey);
                          }
                        }}
                        className={cn(
                          "border-b border-[#F3F4F6] last:border-0 transition-colors hover:bg-[#FAFAFA] cursor-pointer",
                          dateKey === todayKey && "bg-[#FAFAFA]/80",
                        )}
                      >
                        <td className="px-6 py-4 text-sm font-medium tabular-nums text-[#111827]">
                          {fullDateLabel(dateKey)}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6B7280]">{dayName(dateKey)}</td>
                        <td className="px-6 py-4">
                          {day?.records?.length ? (
                            <PunchTimeline records={day.records} />
                          ) : (
                            <span className="text-sm text-[#9CA3AF]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm tabular-nums text-[#111827]">
                          {day?.workLabel ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6B7280]">{workShiftName}</td>
                        <td className="px-6 py-4 text-sm text-[#6B7280]">
                          {isRegularized ? (
                            <span className="inline-flex items-center gap-1.5 text-[#111827]">
                              <CheckCircle className="size-3.5 text-[#6B7280]" strokeWidth={1.75} />
                              Regularized
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <AttendanceStatusCell status={status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#F3F4F6] lg:hidden">
              {monthRows.map(({ dateKey, day }) => {
                const status = resolveAttendanceStatus(day, dateKey);
                const isRegularized = regularizedDates.has(dateKey);
                return (
                  <div
                    key={dateKey}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDateKey(dateKey)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDateKey(dateKey);
                      }
                    }}
                    className="px-6 py-5 transition-colors hover:bg-[#FAFAFA] cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums text-[#111827]">
                          {fullDateLabel(dateKey)}
                          <span className="ml-2 font-normal text-[#6B7280]">{dayName(dateKey)}</span>
                        </p>
                        <p className="mt-1 text-[13px] text-[#6B7280]">
                          {day?.workLabel ?? "—"} · {workShiftName}
                          {isRegularized ? " · Regularized" : ""}
                        </p>
                      </div>
                      <AttendanceStatusCell status={status} />
                    </div>
                    {day?.records?.length ? (
                      <div className="mt-4">
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

      <Dialog open={!!selectedDateKey} onOpenChange={(open) => { if (!open) setSelectedDateKey(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDateKey
                ? `${fullDateLabel(selectedDateKey)} · ${dayName(selectedDateKey)}`
                : "Attendance"}
            </DialogTitle>
          </DialogHeader>
          {selectedPunches?.checkIn || selectedPunches?.checkOut ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <PunchLocationBlock label="Check-in" punch={selectedPunches.checkIn} />
              <PunchLocationBlock label="Check-out" punch={selectedPunches.checkOut} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No check-in or check-out recorded for this date.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Reserved status variants for future leave / holiday / WFH integration
export const ATTENDANCE_STATUS_PRESETS: Record<
  Extract<AttendanceStatusKind, "leave" | "holiday" | "wfh">,
  AttendanceStatusMeta
> = {
  leave: { kind: "leave", label: "Leave", icon: Briefcase, iconClassName: "text-[#6B7280]" },
  holiday: { kind: "holiday", label: "Holiday", icon: Flag, iconClassName: "text-[#6B7280]" },
  wfh: { kind: "wfh", label: "Work From Home", icon: Home, iconClassName: "text-[#6B7280]" },
};
