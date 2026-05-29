import { buildDaySummary, type PunchRecord } from "./attendanceDuration";

export interface AttendanceLocationRecord extends PunchRecord {
  id: number;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  address?: string | null;
}

export interface AttendanceDaySummary {
  dateKey: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workSeconds: number;
  breakSeconds: number;
  workLabel: string;
  breakLabel: string;
  accuracy: number | null;
  records: AttendanceLocationRecord[];
}

export function groupAttendanceByDay(records: AttendanceLocationRecord[]): AttendanceDaySummary[] {
  const byDate: Record<string, AttendanceLocationRecord[]> = {};
  records.forEach((r) => {
    const key = new Date(r.checkinTime).toDateString();
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  });

  return Object.entries(byDate)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([dateKey, recs]) => {
      const summary = buildDaySummary(recs);
      const ci = recs.find((r) => r.checkType === "CHECK_IN") || null;
      const co = [...recs].reverse().find((r) => r.checkType === "CHECK_OUT") || null;
      return {
        dateKey,
        date: summary.date,
        checkIn: summary.checkIn,
        checkOut: summary.checkOut,
        workSeconds: summary.workSeconds,
        breakSeconds: summary.breakSeconds,
        workLabel: summary.workLabel,
        breakLabel: summary.breakLabel,
        accuracy: ci?.accuracy ?? co?.accuracy ?? null,
        records: [...recs].sort(
          (a, b) => new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
        ),
      };
    });
}

export function filterDaysByCount(days: AttendanceDaySummary[], count: number) {
  return days.slice(0, count);
}

export function filterDaysByRange(
  days: AttendanceDaySummary[],
  from: string,
  to: string,
): AttendanceDaySummary[] {
  if (!from && !to) return days;
  const fromMs = from ? new Date(from).setHours(0, 0, 0, 0) : null;
  const toMs = to ? new Date(to).setHours(23, 59, 59, 999) : null;
  return days.filter((d) => {
    const t = new Date(d.dateKey).getTime();
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  });
}

export function encodeDateKey(dateKey: string) {
  return encodeURIComponent(dateKey);
}

export function decodeDateKey(encoded: string) {
  return decodeURIComponent(encoded);
}

export function punchTypeLabel(type: string) {
  switch (type) {
    case "CHECK_IN":
      return "Mark IN";
    case "CHECK_OUT":
      return "Mark OUT";
    case "BREAK_IN":
      return "Break IN";
    case "BREAK_OUT":
      return "Break OUT";
    default:
      return type;
  }
}

export function formatPunchTime(iso: string | null | undefined) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatLocationLabel(
  rec: { latitude?: number | null; longitude?: number | null } | null | undefined,
) {
  if (!rec || rec.latitude == null || rec.longitude == null) return "—";
  return `${Number(rec.latitude).toFixed(5)}, ${Number(rec.longitude).toFixed(5)}`;
}

export function extractDayPunchTimes(records: AttendanceLocationRecord[]) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
  );
  const checkIns = sorted.filter((r) => r.checkType === "CHECK_IN");
  const checkOuts = sorted.filter((r) => r.checkType === "CHECK_OUT");
  const breakIns = sorted.filter((r) => r.checkType === "BREAK_IN");
  const breakOuts = sorted.filter((r) => r.checkType === "BREAK_OUT");
  return {
    checkIn: checkIns[0] ?? null,
    checkOut: checkOuts.at(-1) ?? null,
    breakIn: breakIns[0] ?? null,
    breakOut: breakOuts.at(-1) ?? null,
    allBreakIns: breakIns,
    allBreakOuts: breakOuts,
  };
}

export function lastNDaysRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
