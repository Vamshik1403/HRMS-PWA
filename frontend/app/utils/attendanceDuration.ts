export interface PunchRecord {
  checkType: string;
  checkinTime: string;
}

/** Wall-clock date key from stored punch ISO (UTC getters = app wall clock). */
export function punchDateKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const APP_PUNCH_TIMEZONE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_PUNCH_TIMEZONE
    ? process.env.NEXT_PUBLIC_APP_PUNCH_TIMEZONE
    : "Asia/Kolkata";

/** Current calendar day in app punch timezone (matches backend dayWindow). */
export function todayPunchDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_PUNCH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** End of calendar day for punch date keys (wall clock encoded as UTC). */
export function endOfPunchDayUtc(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

export type ComputeDayDurationsOptions = {
  /** When false, open work/break segments stop at end of day (midnight reset). */
  live?: boolean;
  dateKey?: string;
  now?: Date;
};

function resolveDurationContext(
  records: PunchRecord[],
  options: ComputeDayDurationsOptions | Date,
): { asOf: Date; dateKey: string } {
  const opts: ComputeDayDurationsOptions =
    options instanceof Date ? { now: options, live: true } : options;
  const now = opts.now ?? new Date();
  const dateKey =
    opts.dateKey ??
    (records.length > 0
      ? punchDateKeyFromIso(records[0]!.checkinTime)
      : todayPunchDateKey(now));
  const live = opts.live ?? dateKey === todayPunchDateKey(now);
  const asOf = live ? now : endOfPunchDayUtc(dateKey);
  return { asOf, dateKey };
}

function computeBreakMs(sorted: PunchRecord[], asOf: Date): number {
  let breakMs = 0;
  let breakStart: Date | null = null;

  for (const rec of sorted) {
    const t = new Date(rec.checkinTime);
    if (rec.checkType === "BREAK_IN") {
      breakStart = t;
    } else if (rec.checkType === "BREAK_OUT") {
      if (breakStart) breakMs += t.getTime() - breakStart.getTime();
      breakStart = null;
    }
  }

  if (sorted.at(-1)?.checkType === "BREAK_IN" && breakStart) {
    breakMs += Math.max(0, asOf.getTime() - breakStart.getTime());
  }

  return Math.max(0, breakMs);
}

/** First mark-in and last mark-out (only when the day ends with a checkout). */
export function getEffectiveDisplayPunches(records: PunchRecord[]) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
  );
  const checkIns = sorted.filter((r) => r.checkType === "CHECK_IN");
  const checkOuts = sorted.filter((r) => r.checkType === "CHECK_OUT");
  const lastPunch = sorted.at(-1) ?? null;
  const firstIn = checkIns[0] ?? null;
  const lastOut =
    lastPunch?.checkType === "CHECK_OUT" ? (checkOuts.at(-1) ?? null) : null;
  return { sorted, firstIn, lastOut };
}

export function computeDayDurations(
  records: PunchRecord[],
  options: ComputeDayDurationsOptions | Date = {},
) {
  const { asOf } = resolveDurationContext(records, options);
  const { sorted, firstIn, lastOut } = getEffectiveDisplayPunches(records);
  const breakMs = computeBreakMs(sorted, asOf);

  if (!firstIn) {
    return {
      workSeconds: 0,
      breakSeconds: Math.max(0, Math.round(breakMs / 1000)),
    };
  }

  const endMs =
    lastOut != null
      ? new Date(lastOut.checkinTime).getTime()
      : asOf.getTime();
  const workMs = Math.max(
    0,
    endMs - new Date(firstIn.checkinTime).getTime() - breakMs,
  );

  return {
    workSeconds: Math.max(0, Math.round(workMs / 1000)),
    breakSeconds: Math.max(0, Math.round(breakMs / 1000)),
  };
}

export function formatWorkDuration(totalSec: number): string {
  if (totalSec <= 0) return "0m";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

export function formatBreakDuration(totalSec: number): string {
  return formatWorkDuration(totalSec);
}

export function formatWorkHoursDecimal(totalSec: number): string {
  if (totalSec <= 0) return "0.00h";
  return `${(totalSec / 3600).toFixed(2)}h`;
}

/** Whole minutes only — punch times include seconds so raw totals can be fractional. */
export function formatWorkedDuration(totalMinutes: number): string {
  const total = Math.round(totalMinutes);
  if (total <= 0) return "0h";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function buildDaySummary(
  records: PunchRecord[],
  options: ComputeDayDurationsOptions | Date = {},
) {
  const { sorted, firstIn, lastOut } = getEffectiveDisplayPunches(records);
  const checkIns = sorted.filter((r) => r.checkType === "CHECK_IN");
  const checkOuts = sorted.filter((r) => r.checkType === "CHECK_OUT");
  const { workSeconds, breakSeconds } = computeDayDurations(records, options);

  return {
    date: firstIn?.checkinTime || lastOut?.checkinTime || sorted[0]?.checkinTime || "",
    checkIn: firstIn?.checkinTime ?? null,
    checkOut: lastOut?.checkinTime ?? null,
    workSeconds,
    breakSeconds,
    workLabel: formatWorkHoursDecimal(workSeconds),
    breakLabel: formatBreakDuration(breakSeconds),
  };
}
