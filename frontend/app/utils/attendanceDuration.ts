export interface PunchRecord {
  checkType: string;
  checkinTime: string;
}

export function computeDayDurations(records: PunchRecord[], now = new Date()) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
  );

  let workMs = 0;
  let breakMs = 0;
  let workStart: Date | null = null;
  let breakStart: Date | null = null;

  for (const rec of sorted) {
    const t = new Date(rec.checkinTime);

    if (rec.checkType === "CHECK_IN") {
      workStart = t;
    } else if (rec.checkType === "BREAK_IN") {
      if (workStart) workMs += t.getTime() - workStart.getTime();
      workStart = null;
      breakStart = t;
    } else if (rec.checkType === "BREAK_OUT") {
      if (breakStart) breakMs += t.getTime() - breakStart.getTime();
      breakStart = null;
      workStart = t;
    } else if (rec.checkType === "CHECK_OUT") {
      if (workStart) workMs += t.getTime() - workStart.getTime();
      workStart = null;
      breakStart = null;
    }
  }

  const lastType = sorted.at(-1)?.checkType ?? null;
  const onBreak = lastType === "BREAK_IN";
  const inWork = lastType === "CHECK_IN" || lastType === "BREAK_OUT";

  if (inWork && workStart) {
    workMs += now.getTime() - workStart.getTime();
  }
  if (onBreak && breakStart) {
    breakMs += now.getTime() - breakStart.getTime();
  }

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

export function buildDaySummary(records: PunchRecord[], now = new Date()) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
  );
  const checkIns = sorted.filter((r) => r.checkType === "CHECK_IN");
  const checkOuts = sorted.filter((r) => r.checkType === "CHECK_OUT");
  const { workSeconds, breakSeconds } = computeDayDurations(records, now);

  return {
    date: checkIns[0]?.checkinTime || checkOuts.at(-1)?.checkinTime || sorted[0]?.checkinTime || "",
    checkIn: checkIns[0]?.checkinTime ?? null,
    checkOut: checkOuts.at(-1)?.checkinTime ?? null,
    workSeconds,
    breakSeconds,
    workLabel: formatWorkHoursDecimal(workSeconds),
    breakLabel: formatBreakDuration(breakSeconds),
  };
}
