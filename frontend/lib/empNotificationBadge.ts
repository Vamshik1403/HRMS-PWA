/** Employee portal notification / sidebar badge helpers. */
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";
import { taskFetch } from "@/app/utils/taskApi";
import { isActiveTaskStatus } from "@/app/utils/taskStatusFlow";
import {
  countUnseenLeaveBadge,
  countUnseenReimbursementBadge,
} from "@/app/utils/empHomeSeen";
import { getDisplayLeaveStatus } from "@/app/utils/leaveDisplay";
import { isPartiallyApprovedStatus } from "@/app/utils/statusDisplay";
import { getEmployeeIdFromStorage } from "./pushSubscribe";
import { syncAppBadge } from "./appBadge";

const BACKEND =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) ||
  "/backend";

const BELL_LAST_VIEWED_KEY = "_bell_last_viewed";
const NOTICE_LAST_VIEWED_KEY = "_notice_last_viewed";

function readTs(key: string): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(key) || "0", 10) || 0;
}

/** Mark notification feed as viewed so the bell badge clears. */
export function markBellNotificationsViewed() {
  if (typeof window === "undefined") return;
  const now = String(Date.now());
  localStorage.setItem(BELL_LAST_VIEWED_KEY, now);
  localStorage.setItem(NOTICE_LAST_VIEWED_KEY, now);
  window.dispatchEvent(new Event("emp-notifications-changed"));
  window.dispatchEvent(new Event("emp-home-badges-changed"));
  window.dispatchEvent(new Event("emp-sidebar-badges-changed"));
}

/** Mark notice-type memos as viewed (company / noticeboard / More notices). */
export function markNoticesViewed() {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTICE_LAST_VIEWED_KEY, String(Date.now()));
  window.dispatchEvent(new Event("emp-home-badges-changed"));
  window.dispatchEvent(new Event("emp-sidebar-badges-changed"));
}

/**
 * Clear employee portal badges for the route the user just opened.
 * Visiting Home clears the Home/bell badge; visiting Leave/Reimb list clears those module badges.
 */
export async function clearEmpBadgesForVisitedPath(
  pathname: string,
  search = "",
): Promise<void> {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
  const employeeId = getEmployeeIdFromStorage();
  if (!token || !employeeId) return;

  const headers = { Authorization: `Bearer ${token}` };
  const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const path = pathname || "";

  const isHome =
    path.startsWith("/empdashboard") &&
    qs.get("tab") !== "calendar" &&
    !path.includes("tab=calendar");

  if (isHome) {
    markBellNotificationsViewed();
  }

  if (
    path.startsWith("/empNoticeboard") ||
    path.startsWith("/empCompany") ||
    path.startsWith("/empHolidays") ||
    path.startsWith("/empPublicHoliday") ||
    (path.startsWith("/empProfile") && qs.get("tab") === "messaging")
  ) {
    markNoticesViewed();
  }

  if (path.startsWith("/empLeaveApplication")) {
    try {
      const res = await fetch(`${BACKEND}/leave-application/employee/${employeeId}`, {
        headers,
        cache: "no-store",
      });
      if (res.ok) {
        const rows = await res.json();
        const own = (Array.isArray(rows) ? rows : []).filter(
          (r: { manageEmployeeID?: number | null }) =>
            Number(r.manageEmployeeID) === employeeId,
        );
        const {
          markEmpRecordsSeenBulk,
          pendingLeaveRowsForBadge,
        } = await import("@/app/utils/empHomeSeen");
        markEmpRecordsSeenBulk("leave", pendingLeaveRowsForBadge(own));
      }
    } catch {
      /* ignore */
    }
  }

  if (path.startsWith("/empReimbursement")) {
    try {
      const res = await fetch(`${BACKEND}/reimbursement/employee/${employeeId}`, {
        headers,
        cache: "no-store",
      });
      if (res.ok) {
        const rows = await res.json();
        const own = (Array.isArray(rows) ? rows : []).filter(
          (r: { manageEmployeeID?: number | null }) =>
            Number(r.manageEmployeeID) === employeeId,
        );
        const {
          markEmpRecordsSeenBulk,
          pendingReimbRowsForBadge,
        } = await import("@/app/utils/empHomeSeen");
        markEmpRecordsSeenBulk("reimb", pendingReimbRowsForBadge(own));
      }
    } catch {
      /* ignore */
    }
  }

  // Opening More hub: clear notice portion; leave/reimb clear when those modules are opened.
  if (path.startsWith("/empMore")) {
    markNoticesViewed();
  }
}

function loadIdSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0) : []);
  } catch {
    return new Set();
  }
}

/** Bell badge: unseen notification-feed items since last open. */
export async function fetchBellBadgeCount(
  employeeId: number,
  token: string,
): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` };
  const lastViewed = readTs(BELL_LAST_VIEWED_KEY) || readTs(NOTICE_LAST_VIEWED_KEY);

  try {
    const res = await fetch(`${BACKEND}/emp-notifications/feed?recentDays=30&olderDays=0`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const recent = Array.isArray(data?.recent) ? data.recent : [];
    const older = Array.isArray(data?.older) ? data.older : [];
    const items = [...recent, ...older];
    const seen = new Set<string>();
    let count = 0;
    for (const item of items) {
      const id = String(item?.id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const ts = item?.at ? new Date(item.at).getTime() : 0;
      if (Number.isFinite(ts) && ts > lastViewed) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

/** Legacy composite total (home / PWA). Prefer feed for bell. */
export async function fetchEmpNotificationTotal(
  employeeId: number,
  token: string,
): Promise<number> {
  // Bell/home icon now follow the feed watermark so opening notifications clears the badge.
  return fetchBellBadgeCount(employeeId, token);
}

export async function refreshHomeScreenBadge(): Promise<void> {
  const employeeId = getEmployeeIdFromStorage();
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token");
  if (!employeeId || !token) return;
  const total = await fetchEmpNotificationTotal(employeeId, token);
  await syncAppBadge(total);
}

export type EmpSidebarBadgeCounts = {
  home: number;
  im: number;
  approvals: number;
  company: number;
  more: number;
  /** Per-module counts for More grid icons */
  leave: number;
  reimbursement: number;
  tasks: number;
  notices: number;
};

const EMPTY_SIDEBAR_BADGES: EmpSidebarBadgeCounts = {
  home: 0,
  im: 0,
  approvals: 0,
  company: 0,
  more: 0,
  leave: 0,
  reimbursement: 0,
  tasks: 0,
  notices: 0,
};

function isGeneralMemo(memo: { memoType?: string | null; undoneAt?: string | null }) {
  if (memo.undoneAt) return false;
  const type = (memo.memoType || "General").trim().toLowerCase();
  return type === "general";
}

function isNoticeMemo(memo: { memoType?: string | null; undoneAt?: string | null }) {
  if (memo.undoneAt) return false;
  const type = (memo.memoType || "").trim().toLowerCase();
  return type === "information" || type === "notice" || type === "warning" || type === "complaint";
}

function isTeamPendingLeave(
  row: {
    manageEmployeeID?: number | null;
    status?: string | null;
    dayStatuses?: unknown;
  },
  selfId: number,
  reporteeIds: Set<number>,
): boolean {
  const ownerId = Number(row.manageEmployeeID);
  if (!Number.isFinite(ownerId) || ownerId === selfId || !reporteeIds.has(ownerId)) return false;
  // Match EmpTeamApprovalsPanel exactly
  return getDisplayLeaveStatus(row.status, row.dayStatuses) === "Approval Pending";
}

function isTeamPendingReimb(
  row: {
    manageEmployeeID?: number | null;
    status?: string | null;
    items?: { status?: string | null }[] | null;
  },
  selfId: number,
  reporteeIds: Set<number>,
): boolean {
  const ownerId = Number(row.manageEmployeeID);
  if (!Number.isFinite(ownerId) || ownerId === selfId || !reporteeIds.has(ownerId)) return false;
  const status = row.status || "Pending";
  const hasPendingItems = (row.items || []).some((i) => (i.status || "Pending") === "Pending");
  return status === "Pending" || (isPartiallyApprovedStatus(status) && hasPendingItems);
}

function isOwnPendingUnseenLeave(row: {
  manageEmployeeID?: number | null;
  id?: number | string;
  status?: string | null;
}, selfId: number): boolean {
  if (Number(row.manageEmployeeID) !== selfId) return false;
  return countUnseenLeaveBadge([{ id: row.id ?? "", status: row.status }]) > 0;
}

function isOwnPendingUnseenReimb(row: {
  manageEmployeeID?: number | null;
  id?: number | string;
  status?: string | null;
}, selfId: number): boolean {
  if (Number(row.manageEmployeeID) !== selfId) return false;
  return countUnseenReimbursementBadge([{ id: row.id ?? "", status: row.status }]) > 0;
}

/** Sidebar unread / pending counts for emp portal nav (role-aware). */
export async function fetchEmpSidebarBadgeCounts(
  employeeId: number,
  token: string,
  opts?: { isManager?: boolean; reporteeIds?: number[] },
): Promise<EmpSidebarBadgeCounts> {
  const headers = { Authorization: `Bearer ${token}` };
  const counts: EmpSidebarBadgeCounts = { ...EMPTY_SIDEBAR_BADGES };
  let isManager = Boolean(opts?.isManager);
  let reporteeIdList = (opts?.reporteeIds || [])
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0 && id !== employeeId);

  // Resolve manager scope from API when caller didn't pass reportee ids
  if (isManager && reporteeIdList.length === 0) {
    try {
      const scopeRes = await fetch(`${BACKEND}/emp-manager-scope/reportees`, {
        headers,
        cache: "no-store",
      });
      if (scopeRes.ok) {
        const scope = await scopeRes.json();
        isManager = Boolean(scope?.hasReportees);
        reporteeIdList = Array.isArray(scope?.reporteeIds)
          ? scope.reporteeIds
              .map(Number)
              .filter((id: number) => Number.isFinite(id) && id > 0 && id !== employeeId)
          : [];
      }
    } catch {
      /* keep opts */
    }
  }

  const reporteeIds = new Set(reporteeIdList);
  const readIds = loadIdSet(`im-read-${employeeId}`);
  const noticeLastViewed = readTs(NOTICE_LAST_VIEWED_KEY);

  // Same endpoints EmpTeamApprovalsPanel uses: employee/:selfId returns scoped rows
  const [memos, leaveRows, reimbRows, homeBell] = await Promise.all([
    fetch(`${BACKEND}/employee-memo?employeeID=${employeeId}`, { headers, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${BACKEND}/leave-application/employee/${employeeId}`, { headers, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${BACKEND}/reimbursement/employee/${employeeId}`, { headers, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetchBellBadgeCount(employeeId, token),
  ]);

  counts.home = homeBell;

  if (Array.isArray(memos)) {
    let imUnread = 0;
    let notices = 0;
    for (const memo of memos) {
      if (!memo || typeof memo !== "object") continue;
      const id = Number(memo.id);
      const created = memo.createdAt ? new Date(memo.createdAt).getTime() : 0;
      const senderId = Number(memo.senderEmployeeId);
      const recipients: number[] = Array.isArray(memo.employeeIDs)
        ? memo.employeeIDs.map(Number)
        : memo.employeeID != null
          ? [Number(memo.employeeID)]
          : [];

      if (isGeneralMemo(memo)) {
        const isIncoming =
          Number.isFinite(senderId) &&
          senderId > 0 &&
          senderId !== employeeId &&
          (recipients.includes(employeeId) || Number(memo.employeeID) === employeeId);
        if (isIncoming && Number.isFinite(id) && id > 0 && !readIds.has(id)) {
          imUnread += 1;
        }
      }

      if (isNoticeMemo(memo) && created > noticeLastViewed) {
        notices += 1;
      }
    }
    counts.im = imUnread;
    counts.notices = notices;
    counts.company = isManager ? notices : 0;
  }

  const leaves = Array.isArray(leaveRows) ? leaveRows : [];
  const reimbs = Array.isArray(reimbRows) ? reimbRows : [];

  // Own leave/reimb badges — only the current employee's records (role: employee portal self)
  counts.leave = leaves.filter((l) => isOwnPendingUnseenLeave(l, employeeId)).length;
  counts.reimbursement = reimbs.filter((r) => isOwnPendingUnseenReimb(r, employeeId)).length;

  // Team approvals — only manager reportees, same rules as EmpTeamApprovalsPanel
  if (isManager && reporteeIds.size > 0) {
    const pendingLeave = leaves.filter((l) => isTeamPendingLeave(l, employeeId, reporteeIds)).length;
    const pendingReimb = reimbs.filter((r) => isTeamPendingReimb(r, employeeId, reporteeIds)).length;
    counts.approvals = pendingLeave + pendingReimb;
  } else {
    counts.approvals = 0;
  }

  if (TASK_MANAGEMENT_ENABLED) {
    try {
      let user: Record<string, unknown> = { role: "EMPLOYEE", employee: { id: employeeId } };
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        if (stored?.employee?.id) user = stored;
      } catch {
        /* ignore */
      }
      const data = await taskFetch<{ items: { status: string }[] }>(
        "/task-projects",
        user,
        undefined,
        { limit: 100, assignedToMe: 1 },
      );
      counts.tasks = (data.items || []).filter((t) => isActiveTaskStatus(t.status)).length;
    } catch {
      counts.tasks = 0;
    }
  }

  // More sidebar badge = sum of badges on modules visible to this role
  counts.more =
    counts.leave +
    counts.reimbursement +
    counts.tasks +
    counts.notices +
    (isManager ? counts.approvals : 0);

  return counts;
}
