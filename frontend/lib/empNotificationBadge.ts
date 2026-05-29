/** Fetch total pending/unread count for home-screen badge. */
import { taskFetch } from "@/app/utils/taskApi";
import { getEmployeeIdFromStorage } from "./pushSubscribe";
import { syncAppBadge } from "./appBadge";

const BACKEND =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) ||
  "/backend";

export async function fetchEmpNotificationTotal(
  employeeId: number,
  token: string,
): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` };
  let notice = 0;
  let tasks = 0;
  let reimb = 0;
  let leave = 0;

  const lastViewed = parseInt(
    localStorage.getItem("_notice_last_viewed") || "0",
    10,
  );

  await Promise.all([
    fetch(`${BACKEND}/employee-memo?employeeID=${employeeId}`, { headers })
      .then((r) => r.json())
      .then((memos: unknown) => {
        if (!Array.isArray(memos)) return;
        notice = memos.filter((m: { createdAt?: string; employeeID?: number }) => {
          const ts = m.createdAt ? new Date(m.createdAt).getTime() : 0;
          return ts > lastViewed && m.employeeID === employeeId;
        }).length;
      })
      .catch(() => {}),
    (() => {
      let user: Record<string, unknown> = { role: "EMPLOYEE", employee: { id: employeeId } };
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        if (stored?.employee?.id) user = stored;
      } catch {
        /* use minimal viewer */
      }
      return taskFetch<{ items: { status: string }[] }>(
        "/task-projects",
        user,
        undefined,
        { limit: 100 },
      );
    })()
      .then((data) => {
        tasks = (data.items || []).filter(
          (t) => t.status === "Open" || t.status === "WIP",
        ).length;
      })
      .catch(() => {}),
    fetch(`${BACKEND}/reimbursement`, { headers })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        reimb = data.filter(
          (r: { manageEmployeeID?: number; status?: string }) =>
            r.manageEmployeeID === employeeId &&
            (r.status === "Pending" || !r.status),
        ).length;
      })
      .catch(() => {}),
    fetch(`${BACKEND}/leave-application`, { headers })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        leave = data.filter(
          (l: { manageEmployeeID?: number; status?: string }) =>
            l.manageEmployeeID === employeeId && l.status === "Pending",
        ).length;
      })
      .catch(() => {}),
  ]);

  return notice + tasks + reimb + leave;
}

/** Refresh icon badge from API (call on dashboard load / app visible). */
export async function refreshHomeScreenBadge(): Promise<void> {
  const employeeId = getEmployeeIdFromStorage();
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token");
  if (!employeeId || !token) return;
  const total = await fetchEmpNotificationTotal(employeeId, token);
  await syncAppBadge(total);
}
