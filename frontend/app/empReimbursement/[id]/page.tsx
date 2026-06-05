"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { totalAmount, type ReimbursementRow } from "../../components/emp/EmpReimbursementMobile";
import { markEmpRecordSeen } from "../../utils/empHomeSeen";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useEmpManagerScope } from "../../hooks/useEmpManagerScope";
import { isTeamMemberId, nameForEmployeeId } from "../../utils/empManagerDisplay";
import { taskFetch } from "../../utils/taskApi";
import { EmpReimbursementApprovalSheet } from "../../components/emp/EmpReimbursementApprovalSheet";
import { isPartiallyApprovedStatus } from "../../utils/statusDisplay";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function EmpReimbursementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = useCurrentUser();
  const { scope, isManagerView } = useEmpManagerScope();
  const id = String(params.id || "");
  const [row, setRow] = useState<ReimbursementRow | null>(null);
  const [raw, setRaw] = useState<any>(null);
  const [taskInfo, setTaskInfo] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const reload = () =>
    fetch(`${BACKEND}/reimbursement/${id}`, { cache: "no-store", headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => {
        if (!r) return;
        setRaw(r);
        const items = Array.isArray(r.items) ? r.items : [];
        const status = r.status || "Pending";
        markEmpRecordSeen("reimb", r.id, status);
        setRow({
          id: String(r.id),
          date: r.date,
          taskProjectID: r.taskProjectID,
          amount: 0,
          status,
          items,
          manageEmployeeID: r.manageEmployeeID,
          manageEmployee: r.manageEmployee,
        });
        if (r.taskProjectID && user) {
          taskFetch<any>(`/task-projects/${r.taskProjectID}`, user)
            .then((t) => {
              setTaskInfo(
                [t.customer?.customerName, t.site?.branchName, t.taskName].filter(Boolean).join(" · "),
              );
            })
            .catch(() => setTaskInfo(null));
        }
      });

  useEffect(() => {
    void reload();
  }, [id, user]);

  const teamClaim = isTeamMemberId(scope, raw?.manageEmployeeID);
  const hasPendingItems = (row?.items || []).some((i) => (i.status || "Pending") === "Pending");
  const canManagerApprove =
    isManagerView &&
    teamClaim &&
    (row?.status === "Pending" || (isPartiallyApprovedStatus(row?.status) && hasPendingItems));
  const teamName =
    nameForEmployeeId(scope, raw?.manageEmployeeID) ||
    [raw?.manageEmployee?.employeeFirstName, raw?.manageEmployee?.employeeLastName]
      .filter(Boolean)
      .join(" ") ||
    "Team member";

  if (!row) {
    return (
      <EmpMobileLayout>
        <div className="py-16 flex justify-center">
          <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      </EmpMobileLayout>
    );
  }

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-4 pb-8">
        <button type="button" onClick={() => router.back()} className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3">
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-[20px] font-bold text-gray-900 mb-1">Reimbursement details</h1>
        {teamClaim && (
          <p className="text-[12px] font-semibold text-[#2563eb] mb-3">Team member · {teamName}</p>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2 text-[13px] mb-4">
          <p><span className="text-gray-500">Date:</span> {row.date}</p>
          <p><span className="text-gray-500">Task ID:</span> {row.taskProjectID ? `#${row.taskProjectID}` : "—"}</p>
          {taskInfo && <p><span className="text-gray-500">Customer / Site:</span> {taskInfo}</p>}
          <p><span className="text-gray-500">Status:</span> {row.status}</p>
          <p><span className="text-gray-500">Total:</span> ₹{totalAmount(row).toFixed(2)}</p>
        </div>

        <p className="text-[11px] font-bold text-gray-400 uppercase mb-2">Expenses</p>
        <div className="space-y-2">
          {(row.items || []).map((item, i) => {
            const itemStatus = item.status || "Pending";
            const statusClass =
              itemStatus === "Approved"
                ? "text-blue-700 bg-blue-50"
                : itemStatus === "Rejected"
                  ? "text-red-700 bg-red-50"
                  : "text-amber-700 bg-amber-50";
            return (
              <div key={i} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-[12px]">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900">{item.reimbursementType}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                    {itemStatus}
                  </span>
                </div>
                <p className="text-gray-600 mt-0.5">{item.description || "—"}</p>
                {item.paidStatus === "Paid" && (
                  <p className="text-[11px] text-green-700 font-medium mt-0.5">Paid</p>
                )}
                <p className="text-emerald-700 font-bold mt-1">₹{parseFloat(item.amount || "0").toFixed(2)}</p>
              </div>
            );
          })}
        </div>

        {isPartiallyApprovedStatus(row.status) && (
          <p className="text-[12px] text-amber-700 mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
            Some expense lines may have been rejected during partial approval. Contact your manager for details.
          </p>
        )}

        {canManagerApprove && (
          <button
            type="button"
            onClick={() => setApprovalOpen(true)}
            className="mt-5 w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm"
          >
            Review & approve
          </button>
        )}
      </div>

      <EmpReimbursementApprovalSheet
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        reimbursementId={id}
        onDone={() => void reload()}
      />
    </EmpMobileLayout>
  );
}
