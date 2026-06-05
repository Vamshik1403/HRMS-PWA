/** Fetch total pending/unread count for home-screen badge. */
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";
import { taskFetch } from "@/app/utils/taskApi";
import {
  countUnseenLeaveBadge,
  countUnseenReimbursementBadge,
} from "@/app/utils/empHomeSeen";
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

  const scopeIdsPromise = fetch(`${BACKEND}/emp-manager-scope/reportees`, { headers })
    .then((r) => (r.ok ? r.json() : null))
    .then((scope: { reporteeIds?: number[] } | null) =>
      Array.isArray(scope?.reporteeIds) && scope!.reporteeIds!.length
        ? scope!.reporteeIds!
        : [employeeId],
    )
    .catch(() => [employeeId]);

  await Promise.all([
    scopeIdsPromise.then((scopeIds) =>
      Promise.all(
        scopeIds.map((id) =>
          fetch(`${BACKEND}/employee-memo?employeeID=${id}`, { headers })
            .then((r) => r.json())
            .catch(() => []),
        ),
      ).then((lists) => {
        const merged = lists.flat();
        if (!Array.isArray(merged)) return;
        notice = merged.filter((m: { createdAt?: string }) => {
          const ts = m.createdAt ? new Date(m.createdAt).getTime() : 0;
          return ts > lastViewed;
        }).length;
      }),
    ),
    ...(TASK_MANAGEMENT_ENABLED
      ? [
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
                (t) => t.status === "Open" || t.status === "WIP" || t.status === "Reopen",
              ).length;
            })
            .catch(() => {}),
        ]
      : []),
    fetch(`${BACKEND}/reimbursement/employee/${employeeId}`, { headers })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        reimb = countUnseenReimbursementBadge(
          data.map((r: { id?: number; status?: string }) => ({
            id: r.id ?? "",
            status: r.status,
          })),
        );
      })
      .catch(() => {}),
    fetch(`${BACKEND}/leave-application/employee/${employeeId}`, { headers })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        leave = countUnseenLeaveBadge(
          data.map((l: { id?: number; status?: string }) => ({
            id: l.id ?? "",
            status: l.status,
          })),
        );
      })
      .catch(() => {
        fetch(`${BACKEND}/leave-application`, { headers })
          .then((r) => r.json())
          .then((all: unknown) => {
            if (!Array.isArray(all)) return;
            leave = countUnseenLeaveBadge(
              all
                .filter((l: { manageEmployeeID?: number }) => l.manageEmployeeID === employeeId)
                .map((l: { id?: number; status?: string }) => ({ id: l.id ?? "", status: l.status })),
            );
          })
          .catch(() => {});
      }),
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
