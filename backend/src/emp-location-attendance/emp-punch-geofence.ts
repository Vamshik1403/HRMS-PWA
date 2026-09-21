import { BadRequestException } from '@nestjs/common';
import { haversineMeters, parseCoord, parseRadiusMeters } from '../common/geo-distance';
import { forwardGeocode } from '../common/reverse-geocode';

export type FenceKind = 'OFFICE' | 'SITE' | 'HOME';

export type FencePoint = {
  lat: number;
  lng: number;
  type: FenceKind;
  siteId?: number | null;
};

export type SessionFence = {
  type: FenceKind;
  siteId?: number | null;
};

export function normalizePhotoUrl(raw?: string | null): string | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  const match = v.match(/\/uploads\/[^?#\s]+/);
  if (match) return match[0];
  return null;
}

export function wallDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function isClosedTaskStatus(status?: string | null): boolean {
  const key = String(status || '')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
  return (
    key === 'completed' ||
    key === 'closed' ||
    key === 'cancelled' ||
    key === 'canceled' ||
    key === 'cancel'
  );
}

export function composeAddressParts(
  ...parts: Array<string | null | undefined>
): string {
  return parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
}

export function taskActiveOnDate(opts: {
  todayKey: string;
  scheduleDateTime?: Date | null;
  dueDateTime?: Date | null;
  assignedDates: Array<Date | null | undefined>;
}): boolean {
  const starts = [
    opts.scheduleDateTime,
    ...opts.assignedDates,
  ].filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  const startKey = starts.length
    ? wallDateKey(starts.reduce((a, b) => (a.getTime() < b.getTime() ? a : b)))
    : null;
  const endKey = opts.dueDateTime ? wallDateKey(opts.dueDateTime) : null;
  if (!startKey && !endKey) return true;
  if (startKey && endKey) return opts.todayKey >= startKey && opts.todayKey <= endKey;
  if (startKey) return opts.todayKey >= startKey;
  return opts.todayKey <= (endKey as string);
}

export async function resolveCoords(opts: {
  latitude?: unknown;
  longitude?: unknown;
  address?: string | null;
}): Promise<{ lat: number; lng: number; fromGeocode: boolean } | null> {
  const lat = parseCoord(opts.latitude);
  const lng = parseCoord(opts.longitude);
  if (lat != null && lng != null) return { lat, lng, fromGeocode: false };
  const point = await forwardGeocode(opts.address);
  if (!point) return null;
  return { lat: point.lat, lng: point.lng, fromGeocode: true };
}

export function fenceMissMessage(points: FencePoint[]): string {
  const kinds = new Set(points.map((p) => p.type));
  if (kinds.has('SITE')) return 'You are not on the site location';
  if (kinds.has('HOME') && kinds.has('OFFICE')) {
    return 'You are not at the office or home location';
  }
  if (kinds.has('HOME')) return 'You are not at the home location';
  return 'You are not at the office location';
}

export function assertWithinFence(
  latitude: number,
  longitude: number,
  points: FencePoint[],
  radiusMeters: number,
): FencePoint {
  if (!points.length) {
    throw new BadRequestException('No allowed punch location is configured.');
  }
  let nearest: { point: FencePoint; distance: number } | null = null;
  for (const point of points) {
    const distance = haversineMeters(latitude, longitude, point.lat, point.lng);
    if (!nearest || distance < nearest.distance) nearest = { point, distance };
  }
  if (!nearest || nearest.distance > radiusMeters) {
    throw new BadRequestException(fenceMissMessage(points));
  }
  return nearest.point;
}

export function requireRadius(raw: unknown): number {
  const radius = parseRadiusMeters(raw);
  if (radius == null) {
    throw new BadRequestException(
      'Geofence radius is not set for your branch. Ask admin to set Geofence Radius (meters) in My Company → Branches.',
    );
  }
  return radius;
}

export { parseCoord, parseRadiusMeters };
