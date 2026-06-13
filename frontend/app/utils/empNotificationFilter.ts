import type { FeedNotification } from "../components/emp/EmpNotificationsPanel";

const MANAGER_EXCLUDED_KINDS = new Set(["payslip", "birthday"]);

/** Managers only see team/workflow notifications — not personal payroll or social items. */
export function filterNotificationsForViewer(
  items: FeedNotification[],
  isManagerView: boolean,
): FeedNotification[] {
  if (!isManagerView) return items;
  return items.filter((n) => {
    if (MANAGER_EXCLUDED_KINDS.has(n.kind)) return false;
    if (/payslip/i.test(n.title || "")) return false;
    return true;
  });
}
