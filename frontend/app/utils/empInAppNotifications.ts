/** Persisted in-app notifications (e.g. from push while app is open). */

export type StoredInAppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  emoji: string;
  at: string;
  href?: string;
};

const STORAGE_KEY = "_emp_in_app_notifications_v1";
const MAX_STORED = 200;

export function appendInAppNotification(item: Omit<StoredInAppNotification, "id">) {
  if (typeof window === "undefined") return;
  const list = loadInAppNotifications();
  const entry: StoredInAppNotification = {
    ...item,
    id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const next = [entry, ...list.filter((x) => x.id !== entry.id)].slice(0, MAX_STORED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("emp-notifications-changed"));
}

export function loadInAppNotifications(): StoredInAppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
