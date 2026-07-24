/**
 * Lightweight sessionStorage-backed cache for page data.
 * Prevents the "flash of empty state" when navigating between sections.
 * Data is stale-while-revalidate: cached value is shown immediately,
 * then the API re-fetches in the background and updates the view.
 */

const TTLs: Record<string, number> = {
  todayAttendance:  30_000,        // 30 s  — attendance status changes infrequently
  recentAttendance: 120_000,       // 2 min — history list
  empPayslips:      60_000,        // 1 min — payslip list
  empLeaveApps:     30_000,        // 30 s  — leave list (status can change)
  empPwaShowLeaveBalance: 86_400_000, // 24 h — per-employee PWA leave balance visibility
  empReimbursements:30_000,        // 30 s  — reimbursement list
  empMemos:         60_000,        // 1 min — notice board
  empImPanel:       120_000,       // 2 min — internal messaging workspace
  empNotifFeed:     60_000,        // 1 min — notifications feed (SWR)
  sidebarSPs:       300_000,       // 5 min — sidebar service providers
  sidebarCompanies: 300_000,       // 5 min — sidebar companies
};

const DEFAULT_TTL = 60_000; // 1 min fallback

export function getPageCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`_pc_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    const ttl =
      TTLs[key] ??
      (key.startsWith("empNotifFeed") ? TTLs.empNotifFeed : undefined) ??
      DEFAULT_TTL;
    if (Date.now() - ts < ttl) return data;
    sessionStorage.removeItem(`_pc_${key}`);
  } catch {}
  return null;
}

export function setPageCache(key: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`_pc_${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function clearPageCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`_pc_${key}`);
  } catch {}
}

/** Remove all cached pages whose storage key starts with `prefix` (e.g. empNotifFeed). */
export function clearPageCachesByPrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  const needle = `_pc_${prefix}`;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(needle)) sessionStorage.removeItem(key);
    }
  } catch {}
}

export function empNotifFeedCacheKey(employeeId?: number | null): string {
  return employeeId ? `empNotifFeed_${employeeId}` : "empNotifFeed";
}
