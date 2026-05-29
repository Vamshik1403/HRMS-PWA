/** GPS helpers for PWA — one getCurrentPosition per user tap (required on Android). */

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}

const FAST_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20000,
  maximumAge: 0,
};

const PRECISE_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 30000,
  maximumAge: 0,
};

function mapGeoError(err: GeolocationPositionError): string {
  if (err.code === 1) {
    return (
      "Location permission denied. Allow location for this site in Chrome → site settings. " +
      "If you were never prompted, ensure the page is opened via HTTPS and try “Enable location” again."
    );
  }
  if (err.code === 2) return "Location unavailable. Turn on Android Location / GPS and try again.";
  if (err.code === 3) return "Location timed out. Move to an open area and try again.";
  return "Could not get location.";
}

function assertGeolocationAvailable(): void {
  if (typeof window === "undefined") {
    throw new Error("Geolocation is only available in the browser.");
  }
  if (!window.isSecureContext) {
    throw new Error("Location requires HTTPS. Open the HRMS site with https:// in the address bar.");
  }
  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported on this device.");
  }
}

function positionToCoords(pos: GeolocationPosition): LocationCoords {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    capturedAt: new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  };
}

function getCurrentPositionOnce(options: PositionOptions): Promise<LocationCoords> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(positionToCoords(pos)),
      (err) => reject(new Error(mapGeoError(err))),
      options,
    );
  });
}

/**
 * Request GPS on a user gesture (Mark IN, Enable location, punch buttons).
 * Single permission prompt — do not pre-check permissions.query "denied".
 */
export async function fetchGPSOnUserGesture(): Promise<LocationCoords> {
  assertGeolocationAvailable();
  try {
    return await getCurrentPositionOnce(FAST_OPTIONS);
  } catch (first) {
    const msg = first instanceof Error ? first.message : String(first);
    if (msg.includes("timed out") || msg.includes("unavailable")) {
      return getCurrentPositionOnce(PRECISE_OPTIONS);
    }
    throw first;
  }
}

/** @deprecated Use fetchGPSOnUserGesture — kept for existing imports. */
export const fetchGPSWithPermission = fetchGPSOnUserGesture;

/** Passive refresh (no error surfaced on load). Still requires permission already granted. */
export function fetchGPS(): Promise<LocationCoords> {
  assertGeolocationAvailable();
  return getCurrentPositionOnce(PRECISE_OPTIONS);
}

/** Optional: inspect permission without blocking a prompt (support / debug). */
export async function queryGeolocationPermissionState(): Promise<PermissionState | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state;
  } catch {
    return "unsupported";
  }
}
