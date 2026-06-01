/**
 * Device punches are wall-clock times (device local / India time), not UTC instants.
 * Store with Date.UTC(...) and read with getUTC* to avoid server timezone shifting display (+5:30 on UTC servers).
 */

export type DevicePunchParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function parseDevicePunchParts(value: string | null | undefined): DevicePunchParts | null {
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

  const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dmyDash) {
    const [, day, month, year, hour, minute, second] = dmyDash;
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

  if (s.includes('T')) {
    const iso = s.replace(/([+-]\d{2}:\d{2}|Z)$/i, '');
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

/** Store wall-clock components in DB without applying server timezone offset. */
export function devicePunchToStorageDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
        value.getUTCHours(),
        value.getUTCMinutes(),
        value.getUTCSeconds(),
      ),
    );
  }

  const parts = parseDevicePunchParts(String(value));
  if (!parts) {
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        parsed.getUTCHours(),
        parsed.getUTCMinutes(),
        parsed.getUTCSeconds(),
      ),
    );
  }

  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
}

export const DEFAULT_APP_PUNCH_TIMEZONE =
  process.env.APP_PUNCH_TIMEZONE || 'Asia/Kolkata';

/**
 * PWA / server "now" as wall-clock components in the app timezone, stored like device punches.
 * Avoids storing a true UTC instant that displays ~5:30 early on India dashboards.
 */
export function wallClockInZoneToStorageDate(
  date: Date = new Date(),
  timeZone = DEFAULT_APP_PUNCH_TIMEZONE,
): Date {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const pick = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(
      pick('year'),
      pick('month') - 1,
      pick('day'),
      pick('hour'),
      pick('minute'),
      pick('second'),
    ),
  );
}

export function formatDevicePunchStorage(
  value: string | Date | null | undefined,
): { dateKey: string; timeStr: string } | null {
  if (value == null) return null;

  const fromString = typeof value === 'string' ? parseDevicePunchParts(value) : null;
  if (fromString) {
    const dateKey = `${fromString.year}-${String(fromString.month).padStart(2, '0')}-${String(fromString.day).padStart(2, '0')}`;
    const timeStr = `${String(fromString.hour).padStart(2, '0')}:${String(fromString.minute).padStart(2, '0')}:${String(fromString.second).padStart(2, '0')}`;
    return { dateKey, timeStr };
  }

  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;

  const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const timeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
  return { dateKey, timeStr };
}
