/**
 * Lightweight sessionStorage-backed cache for page data.
 * Prevents the "flash of empty state" when navigating between sections.
 * Data is stale-while-revalidate: cached value is shown immediately,
 * then the API re-fetches in the background and updates the view.
 */

const TTLs: Record<string, number> = {
  todayAttendance:  30_000,   // 30 s  — attendance status changes infrequently
  recentAttendance: 120_000,  // 2 min — history list
  empPayslips:      60_000,   // 1 min — payslip list
  empLeaveApps:     30_000,   // 30 s  — leave list (status can change)
  empPwaShowLeaveBalance: 86_400_000, // 24 h — per-employee PWA leave balance visibility
  empReimbursements:30_000,   // 30 s  — reimbursement list
  empMemos:         60_000,   // 1 min — notice board
  empNotifFeed:     60_000,   // 1 min — notifications feed (SWR)
};

const DEFAULT_TTL = 60_000; // 1 min fallback

export function getPageCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`_pc_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    const ttl = TTLs[key] ?? DEFAULT_TTL;
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
