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

export function tokensMatch(expected: string, provided?: string | null): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
