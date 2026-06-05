/** Persisted in-app notifications (e.g. from push while app is open). */

export type StoredInAppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  emoji: string;
  at: string;
  href?: string;
  /** Stable key for notice-board push rows (dedupes with API feed `memo-{id}`). */
  memoId?: number;
  subjectEmployeeId?: number;
  subjectEmployeeName?: string;
  isTeamItem?: boolean;
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

/** Map service-worker push payload to a stored in-app notification row. */
export function pushPayloadToInAppNotification(data: {
  title?: string;
  body?: string;
  url?: string;
  kind?: string;
  memoId?: number;
  isTeamNotification?: boolean;
  subjectEmployeeId?: number;
}): Omit<StoredInAppNotification, "id"> {
  const title = String(data.title || "OpenHRM");
  const body = String(data.body || "");
  const titleLc = title.toLowerCase();

  let kind = data.kind || "general";
  if (!data.kind) {
    if (titleLc.includes("leave")) kind = "leave";
    else if (titleLc.includes("reimbursement")) kind = "reimbursement";
    else if (titleLc.includes("payslip") || titleLc.includes("salary")) kind = "payslip";
    else if (titleLc.includes("memo") || titleLc.includes("notice") || titleLc.includes("warning")) {
      kind = "memo";
    }
  }

  let href =
    typeof data.url === "string" && data.url
      ? data.url
      : kind === "leave"
        ? "/empLeaveApplication"
        : kind === "reimbursement"
          ? "/empReimbursement"
          : kind === "payslip"
            ? "/empPayout"
            : "/empdashboard";

  let emoji = "🔔";
  if (kind === "leave") {
    emoji = titleLc.includes("reject") ? "❌" : titleLc.includes("partial") ? "🟡" : "✅";
  } else if (kind === "reimbursement") {
    emoji = titleLc.includes("reject") ? "❌" : titleLc.includes("paid") ? "💸" : "✅";
  } else if (kind === "payslip") {
    emoji = "🧾";
  } else if (kind === "memo") {
    emoji =
      titleLc.includes("warning") || body.toLowerCase().includes("warning")
        ? "⚠️"
        : "📋";
  }

  return {
    kind,
    title,
    body,
    emoji,
    at: new Date().toISOString(),
    href,
    ...(data.memoId != null ? { memoId: data.memoId } : {}),
    ...(data.isTeamNotification
      ? { isTeamItem: true, subjectEmployeeId: data.subjectEmployeeId }
      : {}),
  };
}

export function appendInAppNotification(item: Omit<StoredInAppNotification, "id">) {
  if (typeof window === "undefined") return;
  const stableId =
    item.kind === "memo" && item.memoId != null
      ? `memo-${item.memoId}`
      : `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: StoredInAppNotification = {
    ...item,
    id: stableId,
  };
  const list = loadInAppNotifications();
  const next = [entry, ...list.filter((x) => x.id !== entry.id)].slice(0, MAX_STORED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("emp-notifications-changed"));
}

export function clearInAppNotifications(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("emp-notifications-changed"));
  } catch {}
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
