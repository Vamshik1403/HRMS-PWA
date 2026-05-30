/**
 * Device punch times are wall-clock (device local), not timezone-shifted instants.
 * Matches backend device-punch-time.ts — display with UTC getters after UTC storage.
 */

export function parseDevicePunchParts(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const s = value.trim();

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dmy) {
    const [, day, month, year, hour, minute, second] = dmy;
    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second ?? 0),
    };
  }

  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (ymd) {
    const [, year, month, day, hour, minute, second] = ymd;
    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second ?? 0),
    };
  }

  if (s.includes("T")) {
    const iso = s.replace(/([+-]\d{2}:\d{2}|Z)$/i, "");
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const [, year, month, day, hour, minute, second] = m;
      return {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour),
        minute: Number(minute),
        second: Number(second ?? 0),
      };
    }
  }

  return null;
}

export function formatDevicePunchForDisplay(
  value: string | Date | null | undefined,
): { dateKey: string; timeStr: string; punchTimeStamp: string } | null {
  if (value == null) return null;

  const parts = typeof value === "string" ? parseDevicePunchParts(value) : null;
  if (parts) {
    const dateKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    const timeStr = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
    return { dateKey, timeStr, punchTimeStamp: `${dateKey} ${timeStr}` };
  }

  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;

  const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const timeStr = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
  return { dateKey, timeStr, punchTimeStamp: `${dateKey} ${timeStr}` };
}
