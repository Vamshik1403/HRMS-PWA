"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Plus } from "lucide-react";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { getPageCache, setPageCache } from "../../utils/pageCache";
import { toast } from "sonner";

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
  description?: string;
}

export function totalAmount(r: ReimbursementRow) {
  if (r.items?.length) {
    return r.items.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
  }
  return r.amount;
}

function displayStatus(s: string) {
  const map: Record<string, string> = {
    Pending: "Pending for Approval",
    Approved: "Approved",
    Rejected: "Rejected",
    "Partly Approved": "Partly Approved",
    "Partly approved": "Partly Approved",
    Paid: "Paid",
  };
  return map[s] || s;
}

export function EmpReimbursementMobile() {
  const user = useCurrentUser();
  const [rows, setRows] = useState<ReimbursementRow[]>(() => getPageCache<ReimbursementRow[]>("empReimbursements") ?? []);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async (empId: number) => {
    try {
      const data = await fetch(`${BACKEND}/reimbursement/employee/${empId}`, { cache: "no-store" }).then(
        (r) => (r.ok ? r.json() : []),
      );
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

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-[22px] font-bold text-gray-900">Reimbursement</h1>
        <p className="text-[12px] text-gray-500 mt-0.5">Your submitted claims</p>
      </div>

      <div className="px-4 flex-1">
        {rows.length === 0 ? (
          <p className="text-[13px] text-gray-400 text-center py-12">No reimbursement requests</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const canEdit = r.status === "Pending";
              const canResubmit = r.status === "Rejected";
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2.5 text-[12px]">
                    <div className="space-y-0.5 min-w-0">
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
            })}
          </div>
        )}
      </div>

      <Link
        href="/empReimbursement/new"
        className="mobile-fab fixed right-4 z-40 w-14 h-14 rounded-full bg-[#2563eb] text-white shadow-lg flex items-center justify-center active:scale-90"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
        aria-label="New reimbursement"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

export { CATEGORIES };
