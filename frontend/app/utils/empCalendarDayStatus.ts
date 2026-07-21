import type { AttendanceDaySummary } from "./empAttendanceHistory";
import { formatPunchTime } from "./empAttendanceHistory";
import { formatWorkHoursDecimal } from "./attendanceDuration";
import { isWeekOffDate } from "./empWorkShiftWeekOff";
import { leaveTypeLabel, parseDayStatuses } from "./leaveDisplay";

export type CalendarDayKind = "present" | "absent" | "holiday" | "weekoff" | "leave" | "none";

export type CalendarDayDisplay = {
  kind: CalendarDayKind;
  statusLabel: string;
  detailLine: string;
  hoursLine: string;
};

type LeaveRow = {
  fromDate?: string;
  toDate?: string;
  status?: string | null;
  appliedLeaveType?: string | null;
  dayStatuses?: unknown;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function expandHolidayDateMap(
  holidays: { name: string; startDate: string; endDate: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const h of holidays) {
    if (!h.startDate) continue;
    const start = new Date(`${h.startDate.slice(0, 10)}T12:00:00`);
    const end = new Date(`${(h.endDate || h.startDate).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
      map.set(key, h.name);
    }
  }
  return map;
}

export function leaveTypeForDate(dateKey: string, leaves: LeaveRow[]): string | null {
  for (const app of leaves) {
    const status = (app.status || "").toLowerCase();
    if (!["approved", "accepted", "partially approved", "revokepending"].includes(status)) continue;

    const ds = parseDayStatuses(app.dayStatuses);
    const dayRow = ds.find((d) => d.date?.slice(0, 10) === dateKey);
    if (dayRow?.status && !["pending", "rejected", "lop"].includes(dayRow.status.toLowerCase())) {
      return leaveTypeLabel(dayRow.status);
    }

    if (!ds.length && app.fromDate && app.toDate) {
      const from = String(app.fromDate).slice(0, 10);
      const to = String(app.toDate).slice(0, 10);
      if (dateKey >= from && dateKey <= to) {
        return leaveTypeLabel(app.appliedLeaveType || app.status || "Leave");
      }
    }
  }
  return null;
}

export function resolveCalendarDayDisplay({
  dateKey,
  todayKey,
  attendance,
  weekOffDays,
  holidayMap,
  leaves,
}: {
  dateKey: string;
  todayKey: string;
  attendance?: AttendanceDaySummary;
  weekOffDays: Set<string>;
  holidayMap: Map<string, string>;
  leaves: LeaveRow[];
}): CalendarDayDisplay {
  const leaveType = leaveTypeForDate(dateKey, leaves);
  if (leaveType) {
    return {
      kind: "leave",
      statusLabel: "Leave",
      detailLine: leaveType,
      hoursLine: "",
    };
  }

  if (dateKey > todayKey) {
    return { kind: "none", statusLabel: "", detailLine: "", hoursLine: "" };
  }

  const holidayName = holidayMap.get(dateKey);
  if (holidayName) {
    return {
      kind: "holiday",
      statusLabel: "Holiday",
      detailLine: holidayName,
      hoursLine: "",
    };
  }

  if (isWeekOffDate(dateKey, weekOffDays)) {
    return {
      kind: "weekoff",
      statusLabel: "Weekoff",
      detailLine: "",
      hoursLine: "",
    };
  }

  if (attendance?.checkIn) {
    const inTime = formatPunchTime(attendance.checkIn);
    const outTime = attendance.checkOut ? formatPunchTime(attendance.checkOut) : "—";
    const hours =
      attendance.workSeconds > 0 ? formatWorkHoursDecimal(attendance.workSeconds) : "0.00";
    return {
      kind: "present",
      statusLabel: "Present",
      detailLine: `${inTime} - ${outTime}`,
      hoursLine: `${hours} Hrs`,
    };
  }

  return {
    kind: "absent",
    statusLabel: "Absent",
    detailLine: "",
    hoursLine: "",
  };
}
