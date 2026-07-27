"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Wallet } from "lucide-react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { EmpDesktopWorkspaceGate } from "../../components/emp/EmpDesktopWorkspaceGate";
import { EmpDesktopPage } from "../../components/emp/desktop/EmpDesktopPage";
import { totalAmount, type ReimbursementRow } from "../../components/emp/EmpReimbursementMobile";
import { markEmpRecordSeen } from "../../utils/empHomeSeen";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useEmpManagerScope } from "../../hooks/useEmpManagerScope";
import { isTeamMemberId, nameForEmployeeId } from "../../utils/empManagerDisplay";
import { taskFetch } from "../../utils/taskApi";
import { EmpReimbursementApprovalSheet } from "../../components/emp/EmpReimbursementApprovalSheet";
import { isPartiallyApprovedStatus } from "../../utils/statusDisplay";
import { Button } from "../../components/ui/button";
import { cn } from "@/app/utils/cn";

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

  const summaryFields = [
    { label: "Date", value: row.date || "—" },
    { label: "Task ID", value: row.taskProjectID ? `#${row.taskProjectID}` : "—" },
    { label: "Customer / Site", value: taskInfo || "—" },
    { label: "Status", value: row.status || "—" },
    { label: "Total", value: `₹${totalAmount(row).toFixed(2)}` },
  ];

  const statusBadge = (itemStatus: string) => {
    const statusClass =
      itemStatus === "Approved"
        ? "text-blue-700 bg-blue-50"
        : itemStatus === "Rejected"
          ? "text-red-700 bg-red-50"
          : "text-amber-700 bg-amber-50";
    return (
      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", statusClass)}>
        {itemStatus}
      </span>
    );
  };

  const mobile = (
    <div className="px-4 pt-4 pb-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3"
      >
        <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
        Back
      </button>
      <h1 className="text-[20px] font-bold text-gray-900 mb-1">Reimbursement details</h1>
      {teamClaim && (
        <p className="text-[12px] font-semibold text-[#2563eb] mb-3">Team member · {teamName}</p>
      )}
      <div className="mb-4 rounded-2xl border border-[#cbd5e1] bg-card shadow-sm p-5 space-y-2 text-[13px]">
        {summaryFields.map((f) => (
          <p key={f.label}>
            <span className="text-muted-foreground">{f.label}:</span> {f.value}
          </p>
        ))}
      </div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">Expenses</p>
      <div className="space-y-2">
        {(row.items || []).map((item, i) => {
          const itemStatus = item.status || "Pending";
          return (
            <div key={i} className="rounded-xl border border-[#cbd5e1] bg-card px-3 py-2.5 text-[12px]">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">{item.reimbursementType}</p>
                {statusBadge(itemStatus)}
              </div>
              <p className="text-muted-foreground mt-0.5">{item.description || "—"}</p>
              {item.paidStatus === "Paid" && (
                <p className="text-[11px] text-green-700 font-medium mt-0.5">Paid</p>
              )}
              <p className="text-emerald-700 font-bold mt-1">
                ₹{parseFloat(item.amount || "0").toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>
      {isPartiallyApprovedStatus(row.status) && (
        <p className="text-[12px] text-amber-700 mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
          Some expense lines may have been rejected during partial approval. Contact your manager for
          details.
        </p>
      )}
      {canManagerApprove && (
        <Button
          type="button"
          className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setApprovalOpen(true)}
        >
          Review & approve
        </Button>
      )}
    </div>
  );

  const desktop = (
    <EmpDesktopPage
      title="Reimbursement details"
      description={teamClaim ? `Team member · ${teamName}` : "Claim details"}
      icon={Wallet}
      actions={
        <div className="flex items-center gap-2">
          {canManagerApprove ? (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setApprovalOpen(true)}
            >
              Review & approve
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
            Back
          </Button>
        </div>
      }
    >
      <div className="w-full space-y-5">
        <section className="rounded-2xl border border-[#cbd5e1] bg-card shadow-sm overflow-hidden">
          <div className="border-b border-[#cbd5e1] bg-muted/30 px-6 py-3">
            <h2 className="text-sm font-semibold text-foreground">Claim summary</h2>
          </div>
          <div className="grid grid-cols-2 gap-0 lg:grid-cols-3 xl:grid-cols-5">
            {summaryFields.map((f, i) => (
              <div
                key={f.label}
                className={cn(
                  "px-6 py-4 border-[#cbd5e1]",
                  i < summaryFields.length - 1 && "lg:border-r",
                  i % 2 === 0 && i < summaryFields.length - 1 && "border-r xl:border-r",
                  i >= 2 && "border-t lg:border-t-0",
                  i >= 3 && "border-t xl:border-t-0",
                  i === 4 && "col-span-2 lg:col-span-1 border-t xl:border-t-0",
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-[15px] font-semibold text-foreground break-words",
                    f.label === "Total" && "text-emerald-700",
                  )}
                >
                  {f.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#cbd5e1] bg-card shadow-sm overflow-hidden">
          <div className="border-b border-[#cbd5e1] bg-muted/30 px-6 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Expenses</h2>
            <p className="text-[12px] text-muted-foreground">
              {(row.items || []).length} line{(row.items || []).length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-[#cbd5e1] bg-muted/20">
                  <th className="px-6 py-3 text-[12px] font-semibold text-muted-foreground">Type</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-muted-foreground">Description</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-muted-foreground">Paid</th>
                  <th className="px-6 py-3 text-[12px] font-semibold text-muted-foreground text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {(row.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      No expense lines
                    </td>
                  </tr>
                ) : (
                  (row.items || []).map((item, i) => {
                    const itemStatus = item.status || "Pending";
                    return (
                      <tr key={i} className="border-b border-[#cbd5e1]/80 last:border-0">
                        <td className="px-6 py-3.5 text-[14px] font-semibold text-foreground">
                          {item.reimbursementType || "—"}
                        </td>
                        <td className="px-6 py-3.5 text-[14px] text-muted-foreground">
                          {item.description || "—"}
                        </td>
                        <td className="px-6 py-3.5">{statusBadge(itemStatus)}</td>
                        <td className="px-6 py-3.5 text-[13px] text-muted-foreground">
                          {item.paidStatus === "Paid" ? (
                            <span className="font-medium text-green-700">Paid</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right text-[14px] font-bold text-emerald-700 tabular-nums">
                          ₹{parseFloat(item.amount || "0").toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isPartiallyApprovedStatus(row.status) && (
          <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            Some expense lines may have been rejected during partial approval. Contact your manager for
            details.
          </p>
        )}
      </div>
    </EmpDesktopPage>
  );

  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate workspace={desktop} mobile={mobile} />
      <EmpReimbursementApprovalSheet
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        reimbursementId={id}
        onDone={() => void reload()}
      />
    </EmpMobileLayout>
  );
}
