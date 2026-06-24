/**
 * Push uses a minimal /push-sw.js (fast activate on iOS).
 * openhrm-sw.js (Workbox) is optional for offline cache and is not required for notifications.
 */

/** Clear legacy Workbox caches that served outdated CSS/JS after deploys. */
export async function clearLegacyPwaCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter(
        (k) =>
          k.startsWith("workbox-") ||
          k === "static-cache" ||
          k === "api-cache" ||
          k === "image-cache" ||
          k === "html-cache" ||
          k === "next-static",
      )
      .map((k) => caches.delete(k)),
  );
}

async function removeLegacyServiceWorkers(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  let removed = false;
  for (const reg of regs) {
    if (!isPushSwRegistration(reg)) {
      await reg.unregister().catch(() => undefined);
      removed = true;
    }
  }
  if (removed) await clearLegacyPwaCaches();
  return removed;
}

const LEGACY_SW_CLEANUP_KEY = "_pwa_legacy_sw_cleanup_v2";

const PUSH_SW_URL = "/push-sw.js";

function registrationScriptUrl(reg: ServiceWorkerRegistration): string {
  const w = reg.active ?? reg.waiting ?? reg.installing;
  return w?.scriptURL ?? "";
}

/** Push must use push-sw.js — Workbox + worker-push.js alone breaks in-app notification sync. */
export function isPushSwRegistration(reg: ServiceWorkerRegistration): boolean {
  return registrationScriptUrl(reg).includes("push-sw.js");
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function verifyPushServiceWorkerScript(): Promise<boolean> {
  try {
    const res = await fetch(PUSH_SW_URL, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearServiceWorkerRegistrations(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
}

async function waitForActive(
  reg: ServiceWorkerRegistration,
  maxMs: number,
): Promise<boolean> {
  if (reg.active) return true;

  const worker = reg.installing ?? reg.waiting;
  if (!worker) return false;

  await Promise.race([
    new Promise<void>((resolve) => {
      const onState = () => {
        if (reg.active || worker.state === "activated") {
          worker.removeEventListener("statechange", onState);
          resolve();
        }
      };
      worker.addEventListener("statechange", onState);
      if (worker.state === "activated") resolve();
    }),
    delay(maxMs),
  ]);

  return !!reg.active;
}

async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(PUSH_SW_URL, {
    scope: "/",
    updateViaCache: "none",
  });
}

/**
 * Ensure minimal push SW is registered and active.
 */
export async function ensureServiceWorkerReady(options?: {
  allowReload?: boolean;
  maxWaitMs?: number;
}): Promise<ServiceWorkerRegistration> {
  const allowReload = options?.allowReload ?? false;
  const maxWaitMs = options?.maxWaitMs ?? 25000;

  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers not supported");
  }

  if (!(await verifyPushServiceWorkerScript())) {
    throw new Error("Notification service unavailable. Check your connection.");
  }

  let reg = await navigator.serviceWorker.getRegistration("/");

  // Drop Workbox (or any non-push SW) so push + postMessage use push-sw.js
  if (reg && (!reg.active || !isPushSwRegistration(reg))) {
    await reg.unregister().catch(() => undefined);
    reg = undefined;
  }

  if (!reg) {
    reg = await registerPushServiceWorker();
  } else {
    await reg.update().catch(() => undefined);
  }

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      await delay(500);
    }

    if (await waitForActive(reg, 4000)) {
      return reg;
    }

    reg = (await navigator.serviceWorker.getRegistration("/")) ?? reg;
    if (!reg?.active) {
      await clearServiceWorkerRegistrations();
      reg = await registerPushServiceWorker();
    }
    await delay(300);
  }

  if (allowReload && !sessionStorage.getItem("_sw_push_reload")) {
    sessionStorage.setItem("_sw_push_reload", "1");
    window.location.reload();
    await delay(120000);
  }

  throw new Error("Could not start notifications. Pull to refresh, then tap Enable again.");
}

/** Register push SW as early as possible. */
export function bootstrapServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  void (async () => {
    try {
      const removedLegacy = await removeLegacyServiceWorkers();
      if (removedLegacy && !sessionStorage.getItem(LEGACY_SW_CLEANUP_KEY)) {
        sessionStorage.setItem(LEGACY_SW_CLEANUP_KEY, "1");
        window.location.reload();
        return;
      }

      let reg = await navigator.serviceWorker.getRegistration("/");
      if (reg && (!reg.active || !isPushSwRegistration(reg))) {
        await reg.unregister().catch(() => undefined);
        await clearLegacyPwaCaches();
        reg = undefined;
      }
      if (!reg) {
        await registerPushServiceWorker();
      }
    } catch (e) {
      console.warn("[push-sw] bootstrap", e);
    }
  })();
}

/** Used only for optional UI hint — never block the Enable button on this. */
export async function isServiceWorkerReadyForPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return !!reg?.active && isPushSwRegistration(reg);
}
