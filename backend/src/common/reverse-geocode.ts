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
