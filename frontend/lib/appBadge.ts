/**
 * Home-screen app icon badge (Badging API).
 * Android often updates from push automatically; iOS PWA requires setAppBadge() explicitly.
 */

const BADGE_CACHE = "openhrm-badge-v1";
const BADGE_CACHE_KEY = "https://openhrm.internal/badge-count";

export function isAppBadgeSupported(): boolean {
  return typeof navigator !== "undefined" && "setAppBadge" in navigator;
}

export async function readCachedBadgeCount(): Promise<number> {
  if (typeof caches === "undefined") return 0;
  try {
    const cache = await caches.open(BADGE_CACHE);
    const res = await cache.match(BADGE_CACHE_KEY);
    if (!res) return 0;
    const n = parseInt(await res.text(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function writeCachedBadgeCount(count: number): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(BADGE_CACHE);
    const safe = Math.max(0, Math.floor(count));
    await cache.put(BADGE_CACHE_KEY, new Response(String(safe)));
  } catch {
    /* ignore */
  }
}

/** Update the installed app icon badge (iOS + Android PWA). */
function postBadgeToServiceWorker(count: number): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage({ type: "SET_BADGE_COUNT", count });
    })
    .catch(() => {});
}

export async function syncAppBadge(count: number): Promise<void> {
  const safe = Math.max(0, Math.floor(count));
  await writeCachedBadgeCount(safe);
  postBadgeToServiceWorker(safe);
  if (!isAppBadgeSupported()) return;
  try {
    if (safe > 0) {
      await navigator.setAppBadge(safe);
    } else {
      await navigator.clearAppBadge();
    }
  } catch {
    /* permission or platform */
  }
}

export async function clearAppBadge(): Promise<void> {
  await syncAppBadge(0);
}
