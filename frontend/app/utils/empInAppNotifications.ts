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

function isLegacyTaskChatRow(
  row: StoredInAppNotification,
  consolidated: StoredInAppNotification,
): boolean {
  if (row.id === consolidated.id) return true;
  const title = consolidated.title || "";
  if (!title.startsWith("Task message")) return false;
  return row.title === title;
}

/** One in-app row per task chat — latest message updates the same notification. */
export function upsertInAppNotification(item: StoredInAppNotification) {
  if (typeof window === "undefined") return;
  const list = loadInAppNotifications();
  const next = [
    item,
    ...list.filter((x) => !isLegacyTaskChatRow(x, item)),
  ].slice(0, MAX_STORED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("emp-notifications-changed"));
}

export function appendInAppNotification(item: Omit<StoredInAppNotification, "id">) {
  if (typeof window === "undefined") return;
  const entry: StoredInAppNotification = {
    ...item,
    id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const list = loadInAppNotifications();
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

/** Collapse many per-message task rows into one per task title (legacy localStorage). */
export function consolidateStoredTaskChatNotifications(): void {
  if (typeof window === "undefined") return;
  const list = loadInAppNotifications();
  const taskByTitle = new Map<string, StoredInAppNotification>();
  const rest: StoredInAppNotification[] = [];

  for (const row of list) {
    const isTaskMsg =
      row.kind === "task" ||
      (typeof row.title === "string" && row.title.startsWith("Task message"));
    if (!isTaskMsg) {
      rest.push(row);
      continue;
    }
    const key = row.title || row.id;
    const prev = taskByTitle.get(key);
    if (!prev || new Date(row.at).getTime() > new Date(prev.at).getTime()) {
      taskByTitle.set(key, {
        ...row,
        kind: "task",
        emoji: "💬",
        id: row.id.startsWith("task-chat-") ? row.id : `task-chat-${key}`,
        href: row.href || "/empMyTasks",
      });
    }
  }

  const merged = [...taskByTitle.values(), ...rest].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  if (merged.length === list.length) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, MAX_STORED)));
  window.dispatchEvent(new Event("emp-notifications-changed"));
}
