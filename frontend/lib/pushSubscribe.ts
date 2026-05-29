/** Register service worker + Web Push subscription and persist on the backend. */

import {
  clearServiceWorkerRegistrations,
  ensureServiceWorkerReady,
} from "./serviceWorker";

export const PUSH_BACKEND =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) ||
  "/backend";

export type PushSubscribeResult =
  | { ok: true; employeeID: number }
  | { ok: false; reason: string };

/** Only one registration at a time (modal + banner + layout share this). */
let registerLock: Promise<PushSubscribeResult> | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    delay(ms).then(() => {
      throw new Error(`${label} timed out after ${ms / 1000}s`);
    }),
  ]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function keyBytesMatch(
  a: ArrayBuffer | Uint8Array | null | undefined,
  b: Uint8Array<ArrayBuffer>,
): boolean {
  if (!a) return false;
  const av = a instanceof Uint8Array ? a : new Uint8Array(a as ArrayBuffer);
  if (av.length !== b.length) return false;
  for (let i = 0; i < av.length; i++) {
    if (av[i] !== b[i]) return false;
  }
  return true;
}

function hasValidSubscriptionKeys(sub: PushSubscription): boolean {
  try {
    const json = sub.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) return false;
    const p256 = urlBase64ToUint8Array(json.keys.p256dh);
    const auth = urlBase64ToUint8Array(json.keys.auth);
    return p256.length === 65 && auth.length === 16;
  } catch {
    return false;
  }
}

function getAuthHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** manageEmployeeID from JWT (most reliable). */
export function getEmployeeIdFromToken(): number | null {
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    const isEmployee =
      payload?.type === "employee" || payload?.role === "EMPLOYEE";
    if (!isEmployee) return null;
    const raw = payload.employeeId ?? payload.sub;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Resolve manage-employee id from JWT, then localStorage. */
export function getEmployeeIdFromStorage(): number | null {
  const fromToken = getEmployeeIdFromToken();
  if (fromToken) return fromToken;

  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const isEmployee =
      user?.type === "employee" ||
      String(user?.role || "").toUpperCase() === "EMPLOYEE";
    if (!isEmployee) return null;

    const raw =
      user?.employee?.id ?? user?.employeeId ?? user?.id ?? null;
    if (raw == null) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function ensurePushSubscription(
  reg: ServiceWorkerRegistration,
  applicationServerKey: Uint8Array<ArrayBuffer>,
): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    const serverKey = existing.options?.applicationServerKey;
    const sameVapid =
      !serverKey || keyBytesMatch(serverKey, applicationServerKey);
    if (sameVapid && hasValidSubscriptionKeys(existing)) {
      return existing;
    }
    try {
      await withTimeout(existing.unsubscribe(), 5000, "Unsubscribe old push");
    } catch {
      /* ignore */
    }
  }

  return withTimeout(
    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    }),
    20000,
    "Push subscription",
  );
}

async function waitForEmployeeId(maxMs = 4000): Promise<number | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const id = getEmployeeIdFromStorage();
    if (id) return id;
    await delay(200);
  }
  return null;
}

async function reportPushFailure(
  employeeID: number | null,
  reason: string,
): Promise<void> {
  try {
    await fetch(`${PUSH_BACKEND}/push-notifications/register-failed`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ employeeID, reason }),
    });
  } catch {
    /* ignore */
  }
}

async function registerPushSubscriptionInner(
  requestPermission: boolean,
): Promise<PushSubscribeResult> {
  if (!("Notification" in window) || !("PushManager" in window)) {
    const reason = "Push not supported in this browser";
    void reportPushFailure(null, reason);
    return { ok: false, reason };
  }

  if (!("serviceWorker" in navigator)) {
    const reason = "Service workers not supported";
    void reportPushFailure(null, reason);
    return { ok: false, reason };
  }

  const employeeID = await waitForEmployeeId();
  if (!employeeID) {
    const reason = "Employee session not ready (no employee id in token)";
    void reportPushFailure(null, reason);
    return { ok: false, reason };
  }

  let permission = Notification.permission;
  if (permission === "default" && requestPermission) {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    const reason = `Notification permission: ${permission}`;
    void reportPushFailure(employeeID, reason);
    return { ok: false, reason };
  }

  try {
    const reg = await ensureServiceWorkerReady({ allowReload: true, maxWaitMs: 25000 });
    const keyRes = await withTimeout(
      fetch(`${PUSH_BACKEND}/push-notifications/vapid-public-key`, {
        headers: getAuthHeaders(),
      }),
      10000,
      "VAPID key fetch",
    );
    if (!keyRes.ok) {
      const reason = `VAPID key fetch failed (${keyRes.status})`;
      void reportPushFailure(employeeID, reason);
      return { ok: false, reason };
    }
    const { publicKey } = await keyRes.json();
    if (!publicKey || typeof publicKey !== "string") {
      const reason = "VAPID public key missing on server";
      void reportPushFailure(employeeID, reason);
      return { ok: false, reason };
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    const subscription = await ensurePushSubscription(reg, applicationServerKey);
    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      const reason = "Invalid push subscription from browser";
      void reportPushFailure(employeeID, reason);
      return { ok: false, reason };
    }
    if (!hasValidSubscriptionKeys(subscription)) {
      const reason = "Push subscription keys are invalid or truncated";
      void reportPushFailure(employeeID, reason);
      return { ok: false, reason };
    }

    const saveRes = await withTimeout(
      fetch(`${PUSH_BACKEND}/push-notifications/subscribe`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeID, subscription: subJson }),
      }),
      10000,
      "Save subscription",
    );
    if (!saveRes.ok) {
      const errText = await saveRes.text().catch(() => "");
      const reason = `Subscribe API failed (${saveRes.status})${errText ? `: ${errText.slice(0, 120)}` : ""}`;
      localStorage.removeItem("_push_subscribed");
      void reportPushFailure(employeeID, reason);
      return { ok: false, reason };
    }

    localStorage.setItem("_push_subscribed", "1");
    localStorage.setItem("_push_employee_id", String(employeeID));
    sessionStorage.removeItem("_sw_push_reload");
    return { ok: true, employeeID };
  } catch (err) {
    localStorage.removeItem("_push_subscribed");
    const message = err instanceof Error ? err.message : String(err);
    void reportPushFailure(employeeID, message);
    return { ok: false, reason: message };
  }
}

/** Register push subscription (deduplicated — safe to call from modal + banner). */
export function registerPushSubscription(
  requestPermission = false,
): Promise<PushSubscribeResult> {
  if (registerLock) return registerLock;

  registerLock = registerPushSubscriptionInner(requestPermission).finally(() => {
    registerLock = null;
  });

  return registerLock;
}

/** Clear client push flags after app uninstall/reinstall (call on first load). */
export function resetPushClientStateIfNeeded(): void {
  if (typeof window === "undefined") return;
  const marked = localStorage.getItem("_push_subscribed") === "1";
  const hasController = !!navigator.serviceWorker?.controller;
  if (marked && !hasController) {
    localStorage.removeItem("_push_subscribed");
    localStorage.removeItem("_push_employee_id");
    void clearServiceWorkerRegistrations();
  }
}
