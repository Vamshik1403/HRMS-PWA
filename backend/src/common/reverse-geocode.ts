import { Logger } from '@nestjs/common';

/**
 * Lightweight reverse geocoding (lat/lng -> human address) using the free
 * OpenStreetMap Nominatim service. Results are cached in-memory keyed by
 * coordinates rounded to ~11m precision so repeated punches from the same
 * spot never hit the network twice. All failures degrade gracefully to null
 * so punching can never be blocked by geocoding.
 */

const logger = new Logger('ReverseGeocode');

const NOMINATIM_URL =
  process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_SEARCH_URL =
  process.env.NOMINATIM_SEARCH_URL || 'https://nominatim.openstreetmap.org/search';
const GEOCODE_TIMEOUT_MS = Number(process.env.GEOCODE_TIMEOUT_MS || 4000);
const GEOCODE_ENABLED = process.env.GEOCODE_ENABLED !== 'false';

const cache = new Map<string, string | null>();
const MAX_CACHE = 5000;

function cacheKey(lat: number, lng: number): string {
  // 4 decimals ~= 11 metres — good enough to dedupe punches at one location
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export async function reverseGeocode(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): Promise<string | null> {
  if (
    !GEOCODE_ENABLED ||
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const key = cacheKey(latitude, longitude);
  if (cache.has(key)) return cache.get(key) ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const url = `${NOMINATIM_URL}?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenHRM/1.0 (attendance-location)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      if (cache.size < MAX_CACHE) cache.set(key, null);
      return null;
    }
    const data: any = await res.json();
    const address: string | null = data?.display_name || null;
    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(key, address);
    return address;
  } catch (err: any) {
    // Network/timeout — never block punching, just skip the address
    logger.debug(`reverseGeocode failed: ${err?.message || err}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const searchCache = new Map<string, { lat: number; lng: number } | null>();

function searchCacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Address -> lat/lng. Failures return null so the caller can surface a fence error. */
export async function forwardGeocode(
  query: string | null | undefined,
): Promise<{ lat: number; lng: number } | null> {
  const q = String(query || '').trim();
  if (!GEOCODE_ENABLED || q.length < 3) return null;

  const key = searchCacheKey(q);
  if (searchCache.has(key)) return searchCache.get(key) ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenHRM/1.0 (attendance-location)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      if (searchCache.size < MAX_CACHE) searchCache.set(key, null);
      return null;
    }
    const data: any[] = await res.json();
    const lat = Number(data?.[0]?.lat);
    const lng = Number(data?.[0]?.lon);
    const point =
      Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    if (searchCache.size >= MAX_CACHE) searchCache.clear();
    searchCache.set(key, point);
    return point;
  } catch (err: any) {
    logger.debug(`forwardGeocode failed: ${err?.message || err}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
