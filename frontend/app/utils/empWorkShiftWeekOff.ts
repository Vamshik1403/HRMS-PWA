const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WorkShiftDayRow = {
  weekDay?: string | null;
  weeklyOff?: boolean | null;
  shiftType?: string | null;
};

/** Build a set of weekday names (lowercase) that are weekly off for WORK shifts. */
export function buildWeekOffDayNames(days: WorkShiftDayRow[]): Set<string> {
  const set = new Set<string>();
  for (const day of days) {
    if (!day.weeklyOff || !day.weekDay) continue;
    const type = (day.shiftType || "WORK").toUpperCase();
    if (type !== "WORK") continue;
    set.add(day.weekDay.trim().toLowerCase());
  }
  return set;
}

export function weekdayNameForDateKey(dateKey: string): string {
  const dow = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return WEEKDAY_NAMES[dow] ?? "monday";
}

export function isWeekOffDate(dateKey: string, weekOffDays: Set<string>): boolean {
  if (weekOffDays.size === 0) return false;
  return weekOffDays.has(weekdayNameForDateKey(dateKey));
}
