"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Plus } from "lucide-react";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { getPageCache, setPageCache } from "../../utils/pageCache";
import { toast } from "sonner";
import { useEmpManagerScope } from "../../hooks/useEmpManagerScope";
import { isTeamMemberId, nameForEmployeeId } from "../../utils/empManagerDisplay";
import { splitPreviewRecords } from "../../utils/empListLimit";
import { EmpRecordHistorySheet } from "./EmpRecordHistorySheet";
import { EmpListViewMoreButton } from "./EmpListViewMoreButton";
import { EmpReimbursementApprovalSheet } from "./EmpReimbursementApprovalSheet";
import { displayStatusLabel, isPartiallyApprovedStatus } from "../../utils/statusDisplay";
import { EmpPortalPage, empListClass, empPageRootClass } from "./EmpPortalPage";
import { useEmpPortalDesktop } from "../layout/EmpPortalShell";
import { EmpDesktopReimbursementTable } from "./desktop/EmpDesktopReimbursementTable";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { EmpReimbursementApplyForm } from "./EmpReimbursementApplyForm";
import { FormModal } from "../ui/form-modal";
import { Button } from "../ui/button";
import { Wallet } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const CATEGORIES = ["Travelling", "Food", "Accommodation", "Consumables", "Other"] as const;

export interface ReimbursementRow {
  id: string;
  date: string;
  taskProjectID?: number | null;
  amount: number;
  status: string;
  items?: {
    reimbursementType?: string;
    amount?: string;
    description?: string;
    status?: string;
    paidStatus?: string;
  }[];
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
  manageEmployeeID?: number;
  manageEmployee?: {
    employeeFirstName?: string;
    employeeLastName?: string;
    employeeID?: string;
  };
  description?: string;
}

export function totalAmount(r: ReimbursementRow) {
  if (r.items?.length) {
    return r.items.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  }
  return r.amount;
}

function displayStatus(s: string) {
  const label = displayStatusLabel(s);
  const map: Record<string, string> = {
    Pending: "Pending for Approval",
    Approved: "Approved",
    Rejected: "Rejected",
    "Partially Approved": "Partially Approved",
    Paid: "Paid",
  };
  return map[label] || label;
}

export function EmpReimbursementMobile({
  desktopTab,
  embedded = false,
}: { desktopTab?: string; embedded?: boolean } = {}) {
  const user = useCurrentUser();
  const isPortalDesktop = useEmpPortalDesktop();
  const inWorkspace = !!desktopTab;
  const { scope, isManagerView } = useEmpManagerScope();
  const [rows, setRows] = useState<ReimbursementRow[]>(() => getPageCache<ReimbursementRow[]>("empReimbursements") ?? []);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const load = useCallback(async (empId: number) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
        : "";
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    try {
      const data = await fetch(`${BACKEND}/reimbursement/employee/${empId}`, {
        cache: "no-store",
        headers,
      }).then((r) => (r.ok ? r.json() : []));
      const mapped = (Array.isArray(data) ? data : []).map((r: any) => {
        const items =
          Array.isArray(r.items) && r.items.length > 0
            ? r.items.map((i: any) => ({
                reimbursementType: i.reimbursementType,
                amount: i.amount,
                description: i.description,
                status: i.status || "Pending",
                paidStatus: i.paidStatus,
              }))
            : r.reimbursementType
              ? [{
                  reimbursementType: r.reimbursementType,
                  amount: r.amount,
                  description: r.description,
                  status: r.status || "Pending",
                }]
              : [];
        const amt = items.reduce((s: number, i: any) => s + parseFloat(i.amount || "0"), 0);
        return {
          id: String(r.id),
          date: r.date || "",
          taskProjectID: r.taskProjectID ?? null,
          amount: amt,
          status: r.status || "Pending",
          items,
          serviceProviderID: r.serviceProviderID,
          companyID: r.companyID,
          branchesID: r.branchesID,
          manageEmployeeID: r.manageEmployeeID,
          manageEmployee: r.manageEmployee,
        };
      });
      setPageCache("empReimbursements", mapped);
      setRows(mapped);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    if (!user?.username) return;
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((creds) => {
        const id = creds?.employee?.id;
        if (id) {
          setEmployeeId(id);
          load(id);
        }
      });
  }, [user, load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reimbursement request?")) return;
    const res = await fetch(`${BACKEND}/reimbursement/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Could not delete");
    else {
      toast.success("Deleted");
      if (employeeId) load(employeeId);
    }
    setMenuId(null);
  };

  const { preview: previewRows, history: historyRows, hasHistory } = splitPreviewRecords(rows);

  const employeeNameForRow = (r: ReimbursementRow) => {
    if (r.manageEmployee) {
      const n = [r.manageEmployee.employeeFirstName, r.manageEmployee.employeeLastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (n) return n;
    }
    return nameForEmployeeId(scope, r.manageEmployeeID) || "Team member";
  };

  const renderRow = (r: ReimbursementRow) => {
    const canEdit = r.status === "Pending" && !isTeamMemberId(scope, r.manageEmployeeID);
    const canResubmit = r.status === "Rejected" && !isTeamMemberId(scope, r.manageEmployeeID);
    const teamClaim = isTeamMemberId(scope, r.manageEmployeeID);
    const hasPendingItems = (r.items || []).some((i) => (i.status || "Pending") === "Pending");
    const canManagerApprove =
      isManagerView &&
      teamClaim &&
      (r.status === "Pending" || (isPartiallyApprovedStatus(r.status) && hasPendingItems));
    return (
      <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2.5 text-[12px]">
          <div className="space-y-0.5 min-w-0">
            {teamClaim && (
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#2563eb] mb-0.5">
                Team · {employeeNameForRow(r)}
              </p>
            )}
            <p>
              <span className="text-gray-400">Date:</span> {r.date || "—"}
            </p>
            <p>
              <span className="text-gray-400">Task ID:</span>{" "}
              {r.taskProjectID ? `#${r.taskProjectID}` : "—"}
            </p>
            <p>
              <span className="text-gray-400">Amount:</span> ₹{totalAmount(r).toFixed(2)}
            </p>
            <p>
              <span className="text-gray-400">Status:</span> {displayStatus(r.status)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuId(menuId === r.id ? null : r.id)}
            className="w-8 h-8 self-start rounded-lg flex items-center justify-center text-gray-500"
          >
            <Icon icon="solar:menu-dots-bold" className="w-5 h-5" />
          </button>
        </div>
        {menuId === r.id && (
          <div className="border-t border-gray-100 flex flex-wrap px-1 py-1">
            <Link href={`/empReimbursement/${r.id}`} className="text-[12px] font-semibold text-[#2563eb] px-3 py-2">
              Show details
            </Link>
            {canManagerApprove && (
              <button
                type="button"
                className="text-[12px] font-semibold text-emerald-700 px-3 py-2"
                onClick={() => {
                  setApprovalId(r.id);
                  setMenuId(null);
                }}
              >
                Review & approve
              </button>
            )}
            {canEdit && (
              <>
                <Link href={`/empReimbursement/${r.id}/edit`} className="text-[12px] font-semibold text-gray-700 px-3 py-2">
                  Edit
                </Link>
                <button type="button" className="text-[12px] font-semibold text-red-600 px-3 py-2" onClick={() => handleDelete(r.id)}>
                  Delete
                </button>
              </>
            )}
            {canResubmit && (
              <Link href={`/empReimbursement/${r.id}/edit?resubmit=1`} className="text-[12px] font-semibold text-amber-700 px-3 py-2">
                Resubmit
              </Link>
            )}
          </div>
        )}
      </div>
    );
  };

  const showList = !inWorkspace || desktopTab === "overview" || desktopTab === "history" || desktopTab === "approvals";
  const listRows = desktopTab === "approvals"
    ? previewRows.filter((r) => isTeamMemberId(scope, r.manageEmployeeID))
    : previewRows;

  if (inWorkspace) {
    const pageTitle =
      desktopTab === "approvals"
        ? "Reimbursement approvals"
        : desktopTab === "history"
          ? "Reimbursement history"
          : "Reimbursement overview";

    if (embedded) {
      return (
        <>
          {applyOpen ? (
            <FormModal
              open={applyOpen}
              onOpenChange={setApplyOpen}
              title="New reimbursement claim"
              description="Submit expenses for reimbursement"
            >
              <EmpReimbursementApplyForm
                onSuccess={() => {
                  setApplyOpen(false);
                  if (employeeId) load(employeeId);
                }}
                onCancel={() => setApplyOpen(false)}
              />
            </FormModal>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <Button type="button" size="sm" onClick={() => setApplyOpen(true)}>
                  <Plus className="size-4" />
                  New claim
                </Button>
              </div>
              {showList ? (
                <>
                  <EmpDesktopReimbursementTable
                    rows={listRows}
                    isManagerView={isManagerView}
                    employeeNameForRow={employeeNameForRow}
                    onApprove={(id) => setApprovalId(id)}
                    onDelete={handleDelete}
                    title={desktopTab === "approvals" ? "Pending approvals" : "Claims"}
                  />
                  {hasHistory ? (
                    <EmpListViewMoreButton count={historyRows.length} onClick={() => setHistoryOpen(true)} />
                  ) : null}
                </>
              ) : null}
            </>
          )}
          <EmpRecordHistorySheet
            open={historyOpen}
            onClose={() => setHistoryOpen(false)}
            title="Reimbursement history"
            subtitle={`${historyRows.length} older claim(s)`}
          >
            <EmpDesktopReimbursementTable
              rows={historyRows}
              isManagerView={isManagerView}
              employeeNameForRow={employeeNameForRow}
              onApprove={(id) => setApprovalId(id)}
              onDelete={handleDelete}
            />
          </EmpRecordHistorySheet>
          <EmpReimbursementApprovalSheet
            open={!!approvalId}
            onClose={() => setApprovalId(null)}
            reimbursementId={approvalId}
            onDone={() => {
              if (employeeId) load(employeeId);
            }}
          />
        </>
      );
    }

    return (
      <EmpDesktopPage
        title={pageTitle}
        description={isManagerView ? "Review and approve team claims" : "Track your reimbursement claims"}
        icon={Wallet}
        actions={
          <Button asChild>
            <Link href="/empReimbursement/new">
              <Plus className="w-4 h-4" />
              New claim
            </Link>
          </Button>
        }
      >
        {showList ? (
          <>
            <EmpDesktopReimbursementTable
              rows={listRows}
              isManagerView={isManagerView}
              employeeNameForRow={employeeNameForRow}
              onApprove={(id) => setApprovalId(id)}
              onDelete={handleDelete}
              title={desktopTab === "approvals" ? "Pending approvals" : "Claims"}
            />
            {hasHistory ? (
              <EmpListViewMoreButton count={historyRows.length} onClick={() => setHistoryOpen(true)} />
            ) : null}
          </>
        ) : null}
        <EmpRecordHistorySheet
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          title="Reimbursement history"
          subtitle={`${historyRows.length} older claim(s)`}
        >
          <EmpDesktopReimbursementTable
            rows={historyRows}
            isManagerView={isManagerView}
            employeeNameForRow={employeeNameForRow}
            onApprove={(id) => setApprovalId(id)}
            onDelete={handleDelete}
          />
        </EmpRecordHistorySheet>
        <EmpReimbursementApprovalSheet
          open={!!approvalId}
          onClose={() => setApprovalId(null)}
          reimbursementId={approvalId}
          onDone={() => {
            if (employeeId) load(employeeId);
          }}
        />
      </EmpDesktopPage>
    );
  }

  const inner = (
    <div className={inWorkspace ? "" : empPageRootClass(isPortalDesktop)}>
      {!inWorkspace && isPortalDesktop ? (
        <div className="emp-portal-header-row">
          <div>
            <h1>Reimbursement</h1>
            <p className="emp-portal-subtitle">
              {isManagerView ? "Team reimbursement claims — review and approve" : "Your submitted claims"}
            </p>
          </div>
          <Link
            href="/empReimbursement/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            New claim
          </Link>
        </div>
      ) : !inWorkspace ? (
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-[22px] font-bold text-gray-900">Reimbursement</h1>
        <p className="text-[12px] text-gray-500 mt-0.5">
          {isManagerView ? "Team reimbursement claims — review & approve" : "Your submitted claims"}
        </p>
      </div>
      ) : null}

      {showList && (
      <div className={`${isPortalDesktop && !inWorkspace ? "" : inWorkspace ? "" : "px-4"} flex-1`}>
        {rows.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-12">No reimbursement requests</p>
        ) : (
          <>
            <div className={inWorkspace ? "emp-ws-table-list" : empListClass(isPortalDesktop)}>{listRows.map(renderRow)}</div>
            {hasHistory && (
              <EmpListViewMoreButton count={historyRows.length} onClick={() => setHistoryOpen(true)} />
            )}
          </>
        )}
      </div>
      )}

      <EmpRecordHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Reimbursement history"
        subtitle={`${historyRows.length} older claim(s)`}
      >
        <div className="space-y-2">{historyRows.map(renderRow)}</div>
      </EmpRecordHistorySheet>

      <EmpReimbursementApprovalSheet
        open={!!approvalId}
        onClose={() => setApprovalId(null)}
        reimbursementId={approvalId}
        onDone={() => {
          if (employeeId) load(employeeId);
        }}
      />

      <Link
        href="/empReimbursement/new"
        className={`mobile-fab fixed right-4 z-40 w-14 h-14 rounded-full bg-[#2563eb] text-white shadow-lg flex items-center justify-center active:scale-90 ${isPortalDesktop ? "emp-portal-fab-hidden" : ""}`}
        style={isPortalDesktop ? undefined : { bottom: "calc(64px + env(safe-area-inset-bottom))" }}
        aria-label="New reimbursement"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </Link>
    </div>
  );

  if (inWorkspace) return inner;
  return <EmpPortalPage>{inner}</EmpPortalPage>;
}

export { CATEGORIES };
