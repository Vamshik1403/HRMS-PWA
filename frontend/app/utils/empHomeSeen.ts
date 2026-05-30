/** Tracks which reimb/leave records the employee has opened (home card badges). */

const STORAGE_KEYS = {
  reimb: "_emp_seen_reimb_v1",
  leave: "_emp_seen_leave_v1",
} as const;

export type SeenCategory = keyof typeof STORAGE_KEYS;

type SeenMap = Record<string, string>;

function loadMap(category: SeenCategory): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[category]);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMap(category: SeenCategory, map: SeenMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS[category], JSON.stringify(map));
}

export function markEmpRecordSeen(
  category: SeenCategory,
  id: string | number,
  status?: string | null,
) {
  const map = loadMap(category);
  map[String(id)] = status ?? "";
  saveMap(category, map);
  window.dispatchEvent(new Event("emp-home-badges-changed"));
}

/** Reimbursement home badge: pending items not yet opened. */
export function countUnseenReimbursementBadge(
  rows: { id: string | number; status?: string | null }[],
): number {
  const map = loadMap("reimb");
  return rows.filter((r) => {
    const status = r.status || "Pending";
    if (status !== "Pending" && status !== "Partly Approved") return false;
    const seenStatus = map[String(r.id)];
    return seenStatus === undefined;
  }).length;
}

/** Leave home badge: pending applications not yet opened. */
export function countUnseenLeaveBadge(
  rows: { id: string | number; status?: string | null }[],
): number {
  const map = loadMap("leave");
  return rows.filter((r) => {
    if (r.status !== "Pending" && r.status !== "RevokePending") return false;
    return map[String(r.id)] === undefined;
  }).length;
}
