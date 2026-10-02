import { timingSafeEqual } from 'crypto';

export function blank(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function asInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeEnplSiteVisits(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((row: any) => {
    const addressText = blank(row?.addressText || row?.locationLabel || row?.address);
    return {
      ...row,
      addressText,
      locationLabel: blank(row?.locationLabel) || addressText,
    };
  });
}

export function normalizeEnplTaskStatus(status?: string | null): string {
  const value = String(status || '').trim();
  if (value === 'WIP') return 'Work in Progress';
  if (value === 'Closed') return 'Completed';
  return value || 'Open';
}

export function normalizeEnplPriority(priority?: string | null): string {
  const value = String(priority || '').trim();
  if (!value) return 'Medium';
  const key = value.toLowerCase();
  if (key === 'low') return 'Low';
  if (key === 'medium') return 'Medium';
  if (key === 'high') return 'High';
  if (key === 'urgent') return 'Urgent';
  return value;
}

export function liveTaskStatus(body: any): string {
  const job = blank(body?.status);
  if (job) return normalizeEnplTaskStatus(job);
  const remarks = Array.isArray(body?.remarks) ? [...body.remarks] : [];
  remarks.sort(
    (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime(),
  );
  const fromRemark = remarks.find((row) => blank(row?.status));
  if (fromRemark) return normalizeEnplTaskStatus(fromRemark.status);
  return normalizeEnplTaskStatus(body?.status);
}

export function inboundDeletedFlag(body: any): boolean | null {
  if (body?.isDeleted === true || body?.deleted === true) return true;
  if (body?.isDeleted === false || body?.deleted === false) return false;
  return null;
}

export function isInactiveSyncStatus(status?: string | null): boolean {
  const key = String(status || '').trim().toLowerCase();
  return key === 'cancelled' || key === 'canceled' || key === 'deleted' || key === 'inactive';
}

export type EnplContact = {
  contactPerson: string;
  contactNumber: string;
  designation: string | null;
  email: string | null;
};

export function mapEnplContacts(raw: unknown): EnplContact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => ({
      contactPerson: blank(c?.contactPerson || c?.contactName) || '',
      contactNumber: blank(c?.contactNumber) || '',
      designation: blank(c?.designation),
      email: blank(c?.emailAddress || c?.email || c?.contactEmail),
    }))
    .filter((c) => c.contactPerson && c.contactNumber);
}

export function toEnplContacts(rows: Array<{
  contactPerson?: string | null;
  contactName?: string | null;
  contactNumber?: string | null;
  designation?: string | null;
  email?: string | null;
  contactEmail?: string | null;
}>) {
  return (rows || []).map((c) => ({
    contactPerson: c.contactPerson || c.contactName || '',
    contactName: c.contactName || c.contactPerson || '',
    designation: c.designation || null,
    contactNumber: c.contactNumber || '',
    emailAddress: c.email || c.contactEmail || null,
    contactEmail: c.contactEmail || c.email || null,
  }));
}

/** Date-only visit days stay on that calendar date in Asia/Kolkata (noon UTC). */
export function parseVisitCalendarDate(value: unknown): Date | null {
  const text = blank(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match && text.length <= 10) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
  }
  return asDate(value);
}

export function absolutePublicUrl(path: string | null | undefined): string | null {
  const value = blank(path);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const base = (process.env.PUBLIC_APP_URL || 'https://app.openhrm.in').replace(/\/$/, '');
  return value.startsWith('/') ? `${base}${value}` : `${base}/${value}`;
}

export function toShiftHm(raw: unknown): string | null {
  const text = blank(raw);
  if (!text) return null;
  const ampm = text.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)$/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2] || 0);
    const meridiem = ampm[3].toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  const hm = text.match(/^(\d{1,2}):(\d{2})/);
  if (!hm) return null;
  const hour = Number(hm[1]);
  const minute = Number(hm[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

export function weekdayIndex(name: unknown): number | null {
  const key = blank(name)?.toLowerCase();
  if (!key) return null;
  if (key in WEEKDAY_INDEX) return WEEKDAY_INDEX[key];
  if (/^[0-6]$/.test(key)) return Number(key);
  return null;
}

export function kolkataWeekdayIndex(date = new Date()): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  }).format(date);
  return weekdayIndex(name) ?? 0;
}

export function istCalendarKey(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match && value.length <= 10) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function enplVisitPlanFields(
  row: any,
  fallbackLat: string | null,
  fallbackLng: string | null,
) {
  const hasVisit =
    row?.visitSequence != null ||
    row?.visitDate != null ||
    row?.scheduledArrival != null ||
    row?.signOutForTheDay != null ||
    row?.complianceStatus != null;
  const lat = blank(row?.latitude ?? row?.visitLatitude ?? row?.lat) || fallbackLat;
  const lng = blank(row?.longitude ?? row?.visitLongitude ?? row?.lng) || fallbackLng;
  const signOut =
    row?.signOutForTheDay === true || row?.signOutForTheDay === 'true' || row?.signOutForTheDay === 1
      ? true
      : row?.signOutForTheDay === false || row?.signOutForTheDay === 'false' || row?.signOutForTheDay === 0
        ? false
        : null;
  return {
    enplAssignmentId: asInt(row?.assignmentId ?? row?.enplAssignmentId),
    visitSequence: asInt(row?.visitSequence),
    scheduledArrival: asDate(row?.scheduledArrival),
    visitDate: parseVisitCalendarDate(row?.visitDate),
    allowedRadiusMeters: hasVisit ? (asInt(row?.allowedRadiusMeters) ?? 50) : asInt(row?.allowedRadiusMeters),
    graceMinutes: hasVisit ? (asInt(row?.graceMinutes) ?? 15) : asInt(row?.graceMinutes),
    visitDurationMinutes: asInt(row?.visitDurationMinutes),
    visitLatitude: lat,
    visitLongitude: lng,
    complianceStatus: blank(row?.complianceStatus),
    exceptionStatus: blank(row?.exceptionStatus),
    signOutForTheDay: signOut,
  };
}

export type EnplOpenResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  text: string;
};

export function enplResultMessage(result: EnplOpenResult): string {
  const message = result.data?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (Array.isArray(message)) return message.map((item) => String(item)).join(', ');
  const text = (result.text || '').trim();
  return text ? text.slice(0, 400) : `ENPL request failed HTTP ${result.status}`;
}

export function enplAlreadyCompleted(result: EnplOpenResult): boolean {
  if (result.data?.alreadyCompleted === true) return true;
  return /task already completed/i.test(enplResultMessage(result));
}

export function enplOutsideGeofence(result: EnplOpenResult): boolean {
  return result.status === 400 && String(result.data?.code || '') === 'OUTSIDE_GEOFENCE';
}

export function tokensMatch(expected: string, provided?: string | null): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
