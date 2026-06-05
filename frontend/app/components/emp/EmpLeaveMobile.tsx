"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Plus } from "lucide-react";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useEmpLeaveBalance } from "../../hooks/useEmpLeaveBalance";
import { getPageCache, setPageCache } from "../../utils/pageCache";
import {
  getAppliedDateRange,
  getApprovedDateRange,
  getDisplayLeaveStatus,
  getDisplayLeaveType,
} from "../../utils/leaveDisplay";
import { useEmpManagerScope } from "../../hooks/useEmpManagerScope";
import { isTeamMemberId, nameForEmployeeId } from "../../utils/empManagerDisplay";
import { toast } from "sonner";
import { splitPreviewRecords } from "../../utils/empListLimit";
import { EmpRecordHistorySheet } from "./EmpRecordHistorySheet";
import { EmpListViewMoreButton } from "./EmpListViewMoreButton";
import { EmpLeaveApprovalSheet } from "./EmpLeaveApprovalSheet";
import { formatDateShort } from "../../utils/leaveDisplay";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function getUsernameFromStorage(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem("user");
    if (raw) return JSON.parse(raw).username as string | undefined;
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Cached visibility for username — avoids flashing balance cards while API loads. */
function readLeaveBalanceVisibility(username?: string): boolean | null {
  const u = username ?? getUsernameFromStorage();
  if (!u) return null;
  try {
    const fromLs = localStorage.getItem(`empPwaShowLeaveBalance_${u}`);
    if (fromLs === "1") return true;
    if (fromLs === "0") return false;
  } catch {
    /* ignore */
  }
  const cached = getPageCache<boolean>("empPwaShowLeaveBalance");
  return cached === true || cached === false ? cached : null;
}

function writeLeaveBalanceVisibility(username: string, visible: boolean) {
  try {
    localStorage.setItem(`empPwaShowLeaveBalance_${username}`, visible ? "1" : "0");
  } catch {
    /* ignore */
  }
  setPageCache("empPwaShowLeaveBalance", visible);
}

export interface LeaveAppRow {
  id: string;
  manageEmployeeID?: number;
  manageEmployee?: {
    employeeFirstName?: string;
    employeeLastName?: string;
    employeeID?: string;
  };
  fromDate: string;
  toDate: string;
  purpose?: string;
  status?: string;
  appliedLeaveType?: string;
  dayStatuses?: unknown;
  createdAt: string;
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
}

export function EmpLeaveMobile() {
  const user = useCurrentUser();
  const { scope, isManagerView } = useEmpManagerScope();
  const { cards, loading: balanceLoading, load: loadBalance } = useEmpLeaveBalance();
  const [apps, setApps] = useState<LeaveAppRow[]>(() => getPageCache<LeaveAppRow[]>("empLeaveApps") ?? []);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  /** null = not yet known; do not render balance cards until true/false is resolved */
  const [showLeaveBalance, setShowLeaveBalance] = useState<boolean | null>(() =>
    readLeaveBalanceVisibility(),
  );
  const [menuId, setMenuId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [approvalApp, setApprovalApp] = useState<LeaveAppRow | null>(null);

  const loadApps = useCallback(async (empId: number, fetchBalance: boolean) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
        : "";
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    try {
      const data = await fetch(`${BACKEND}/leave-application/employee/${empId}`, {
        cache: "no-store",
        headers,
      }).then((r) => (r.ok ? r.json() : []));
      const mapped = (Array.isArray(data) ? data : []).map((a: any) => ({
          id: String(a.id),
          manageEmployeeID: a.manageEmployeeID,
          manageEmployee: a.manageEmployee,
          fromDate: a.fromDate ? new Date(a.fromDate).toISOString().slice(0, 10) : "",
          toDate: a.toDate ? new Date(a.toDate).toISOString().slice(0, 10) : "",
          purpose: a.purpose,
          status: a.status || "Pending",
          appliedLeaveType: a.appliedLeaveType,
          dayStatuses: a.dayStatuses,
          createdAt: a.createdAt || new Date().toISOString(),
          serviceProviderID: a.serviceProviderID,
          companyID: a.companyID,
          branchesID: a.branchesID,
        }));
      setPageCache("empLeaveApps", mapped);
      setApps(mapped);
      if (fetchBalance) loadBalance(empId);
    } catch {
      setApps([]);
    }
  }, [loadBalance]);

  useEffect(() => {
    if (!user?.username) return;
    const cached = readLeaveBalanceVisibility(user.username);
    if (cached !== null) setShowLeaveBalance(cached);

    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((creds) => {
        const id = creds?.employee?.id ?? creds?.employeeID;
        const cid = creds?.employee?.companyID ?? creds?.companyID ?? null;
        const visible = creds?.employee?.pwaShowLeaveBalance !== false;
        setShowLeaveBalance(visible);
        writeLeaveBalanceVisibility(user.username, visible);

        if (id) {
          setEmployeeId(id);
          loadApps(id, visible);
        }
        if (cid) setCompanyId(Number(cid));
      })
      .catch(() => {
        if (cached === null) setShowLeaveBalance(true);
      });
  }, [user, loadApps]);

  useEffect(() => {
    if (!employeeId || showLeaveBalance !== true) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadApps(employeeId, true);
    }, 15000);
    return () => clearInterval(id);
  }, [employeeId, showLeaveBalance, loadApps]);

  const statusClass = (label: string) => {
    if (label === "Approved") return "text-emerald-700 bg-emerald-50 border-emerald-100";
    if (label === "Rejected") return "text-red-700 bg-red-50 border-red-100";
    if (label === "Partially Approved") return "text-amber-700 bg-amber-50 border-amber-100";
    if (label === "Approval Pending") return "text-blue-700 bg-blue-50 border-blue-100";
    return "text-gray-600 bg-gray-50 border-gray-100";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this leave request?")) return;
    await fetch(`${BACKEND}/leave-application/${id}`, { method: "DELETE" });
    if (employeeId) loadApps(employeeId, showLeaveBalance === true);
    setMenuId(null);
  };

  const { preview: previewApps, history: historyApps, hasHistory } = splitPreviewRecords(apps);

  const employeeNameForRow = (app: LeaveAppRow) => {
    if (app.manageEmployee) {
      const n = [app.manageEmployee.employeeFirstName, app.manageEmployee.employeeLastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (n) return n;
    }
    return nameForEmployeeId(scope, app.manageEmployeeID) || "Team member";
  };

  const renderLeaveCard = (app: LeaveAppRow) => {
    const displayStatus = getDisplayLeaveStatus(app.status, app.dayStatuses);
    const requestDate = formatDateShort(app.createdAt);
    const teamLeave = isTeamMemberId(scope, app.manageEmployeeID);
    const canManagerApprove =
      isManagerView && teamLeave && displayStatus === "Approval Pending";
    const canOwnDelete = !teamLeave && displayStatus === "Approval Pending";
    return (
      <div
        key={app.id}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="px-3 py-2.5 space-y-1.5">
          {teamLeave && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#2563eb]">
              Team · {employeeNameForRow(app)}
            </p>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 text-[11px] text-gray-600 space-y-0.5">
              <p>
                <span className="text-gray-400">Request:</span> {requestDate}
              </p>
              <p>
                <span className="text-gray-400">Applied:</span> {getAppliedDateRange(app)}
              </p>
              <p>
                <span className="text-gray-400">Approved:</span> {getApprovedDateRange(app)}
              </p>
              <p>
                <span className="text-gray-400">Type:</span> {getDisplayLeaveType(app)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusClass(displayStatus)}`}
              >
                {displayStatus}
              </span>
              <button
                type="button"
                onClick={() => setMenuId(menuId === app.id ? null : app.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 active:bg-gray-100"
                aria-label="Actions"
              >
                <Icon icon="solar:menu-dots-bold" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        {menuId === app.id && (
          <div className="border-t border-gray-100 px-2 py-1 flex flex-wrap gap-1">
            <Link
              href={`/empLeaveApplication/${app.id}`}
              className="text-[12px] font-semibold text-[#2563eb] px-3 py-2"
              onClick={() => setMenuId(null)}
            >
              Show Details
            </Link>
            {canManagerApprove && (
              <button
                type="button"
                className="text-[12px] font-semibold text-emerald-700 px-3 py-2"
                onClick={() => {
                  setApprovalApp(app);
                  setMenuId(null);
                }}
              >
                Review & approve
              </button>
            )}
            {canOwnDelete && (
              <button
                type="button"
                className="text-[12px] font-semibold text-red-600 px-3 py-2"
                onClick={() => handleDelete(app.id)}
              >
                Delete Request
              </button>
            )}
            {!teamLeave && (displayStatus === "Approved" || displayStatus === "Partially Approved") && (
              <button
                type="button"
                className="text-[12px] font-semibold text-amber-700 px-3 py-2"
                onClick={() => handleCancel(app)}
              >
                Cancel Leave
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleCancel = async (app: LeaveAppRow) => {
    const reason = prompt("Reason for cancelling leave:");
    if (!reason || reason.trim().length < 3) return;
    await fetch(`${BACKEND}/leave-application/revoke/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revokedReason: reason.trim() }),
    });
    if (employeeId) loadApps(employeeId, showLeaveBalance === true);
    setMenuId(null);
  };

  const balanceVisible = showLeaveBalance === true;

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-[22px] font-bold text-gray-900">Leave</h1>
        <p className="text-[12px] text-gray-500 mt-0.5">
          {isManagerView
            ? "Team leave requests — approve or review"
            : balanceVisible
              ? "Available balance & requests"
              : "Leave requests"}
        </p>
      </div>

      {balanceVisible && (
      <div className="px-4 grid grid-cols-3 gap-2 mb-4">
        {(cards.length ? cards : [
          { key: "sick", label: "Sick", remaining: 0, total: 0 },
          { key: "casual", label: "Casual", remaining: 0, total: 0 },
          { key: "privileged", label: "Privilege", remaining: 0, total: 0 },
        ]).map((c) => (
          <div
            key={c.key}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center"
          >
            <p className="text-[18px] font-bold text-gray-900 tabular-nums leading-none">
              {balanceLoading ? "…" : `${c.remaining}/${c.total}`}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1.5">
              {c.label}
            </p>
          </div>
        ))}
      </div>
      )}

      <div className="px-4 flex-1">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          {isManagerView ? "Team leave requests" : "Leave requests"}
        </p>
        {apps.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-10">No leave requests yet</p>
        ) : (
          <>
            <div className="space-y-2">{previewApps.map(renderLeaveCard)}</div>
            {hasHistory && (
              <EmpListViewMoreButton count={historyApps.length} onClick={() => setHistoryOpen(true)} />
            )}
          </>
        )}
      </div>

      <EmpRecordHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Leave history"
        subtitle={`${historyApps.length} older request(s)`}
      >
        <div className="space-y-2">{historyApps.map(renderLeaveCard)}</div>
      </EmpRecordHistorySheet>

      <EmpLeaveApprovalSheet
        open={!!approvalApp}
        onClose={() => setApprovalApp(null)}
        application={approvalApp}
        onDone={() => {
          if (employeeId) loadApps(employeeId, showLeaveBalance === true);
        }}
      />

      <Link
        href="/empLeaveApplication/new"
        className="mobile-fab fixed right-4 z-40 w-14 h-14 rounded-full bg-[#2563eb] text-white shadow-lg flex items-center justify-center active:scale-90"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
        aria-label="New leave request"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
