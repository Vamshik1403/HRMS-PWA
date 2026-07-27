"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { useEmpPortalDesktop } from "../layout/EmpPortalShell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type ReimbItem = {
  id?: number;
  reimbursementType?: string;
  amount?: string;
  description?: string;
  status?: string;
};

export function EmpReimbursementApprovalSheet({
  open,
  onClose,
  reimbursementId,
  onDone,
  embedded = false,
}: {
  open: boolean;
  onClose: () => void;
  reimbursementId: string | null;
  onDone: () => void;
  embedded?: boolean;
}) {
  const [row, setRow] = useState<{
    status?: string;
    items?: ReimbItem[];
    manageEmployee?: { employeeFirstName?: string; employeeLastName?: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isDesktop = useEmpPortalDesktop();

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    if (!reimbursementId) return;
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/reimbursement/${reimbursementId}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (r.ok) setRow(await r.json());
    } finally {
      setLoading(false);
    }
  }, [reimbursementId]);

  useEffect(() => {
    if (open && reimbursementId) void load();
  }, [open, reimbursementId, load]);

  if (!open || !reimbursementId || !mounted) return null;

  const approveItem = async (itemId: number) => {
    setActing(true);
    try {
      const res = await fetch(
        `${BACKEND}/reimbursement/${reimbursementId}/items/${itemId}/approve`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ actorRole: "MANAGER" }),
        },
      );
      if (!res.ok) throw new Error("Approve failed");
      toast.success("Item approved (Voucher)");
      await load();
      onDone();
    } catch {
      toast.error("Could not approve item");
    } finally {
      setActing(false);
    }
  };

  const rejectItem = async (itemId: number) => {
    if (!confirm("Reject this expense line?")) return;
    setActing(true);
    try {
      const res = await fetch(
        `${BACKEND}/reimbursement/${reimbursementId}/items/${itemId}/reject`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ actorRole: "MANAGER" }),
        },
      );
      if (!res.ok) throw new Error("Reject failed");
      toast.success("Item rejected");
      await load();
      onDone();
    } catch {
      toast.error("Could not reject item");
    } finally {
      setActing(false);
    }
  };

  const rejectAll = async () => {
    if (!confirm("Reject entire reimbursement request?")) return;
    setActing(true);
    try {
      const res = await fetch(`${BACKEND}/reimbursement/${reimbursementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "Rejected" }),
      });
      if (!res.ok) throw new Error("Reject failed");
      toast.success("Reimbursement rejected");
      onDone();
      onClose();
    } catch {
      toast.error("Could not reject");
    } finally {
      setActing(false);
    }
  };

  const items = row?.items ?? [];
  const pendingItems = items.filter((i) => (i.status || "Pending") === "Pending");
  const teamName = [row?.manageEmployee?.employeeFirstName, row?.manageEmployee?.employeeLastName]
    .filter(Boolean)
    .join(" ");

  const useDesktopDialog = !embedded && isDesktop;

  const sheet = (
    <div
      className={
        embedded || useDesktopDialog
          ? "flex flex-col bg-[#f8f9fb] min-h-0"
          : "fixed inset-0 z-[200] flex flex-col bg-[#f8f9fb]"
      }
      style={embedded || useDesktopDialog ? undefined : { paddingTop: "env(safe-area-inset-top)" }}
    >
      {!embedded && !useDesktopDialog && (
      <header className="shrink-0 bg-white border-b px-4 py-3 flex items-center gap-2">
        <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center">
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-[16px] font-bold text-gray-900">Approve reimbursement</h1>
          {teamName && <p className="text-[11px] text-[#2563eb]">Team · {teamName}</p>}
        </div>
      </header>
      )}
      <div className={embedded || useDesktopDialog ? "flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3" : "flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3"}>
        <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
          Approve or reject <strong>each expense line</strong> separately (partial approval). Parent status
          updates when all lines are reviewed.
        </p>
        {loading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
        ) : (
          items.map((item, i) => {
            const itemId = item.id;
            const pending = (item.status || "Pending") === "Pending";
            return (
              <div key={itemId ?? i} className="bg-white rounded-2xl border border-[#cbd5e1] p-4">
                <p className="font-semibold text-[13px]">{item.reimbursementType || "Expense"}</p>
                <p className="text-[12px] text-gray-600 mt-0.5">{item.description || "—"}</p>
                <p className="text-emerald-700 font-bold mt-1">₹{parseFloat(item.amount || "0").toFixed(2)}</p>
                <p className="text-[11px] text-gray-500 mt-1">Status: {item.status || "Pending"}</p>
                {pending && itemId && (
                  <div className="flex gap-2 mt-3">
                    <button type="button" disabled={acting} onClick={() => approveItem(itemId)} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold">Approve</button>
                    <button type="button" disabled={acting} onClick={() => rejectItem(itemId)} className="flex-1 py-2.5 rounded-lg border border-red-200 text-red-600 text-[12px] font-semibold">Reject</button>
                  </div>
                )}
              </div>
            );
          })
        )}
        {!loading && pendingItems.length === 0 && items.length > 0 && (
          <p className="text-center text-[12px] text-gray-500 py-4">All expense lines have been reviewed.</p>
        )}
      </div>
      <footer
        className={embedded || useDesktopDialog ? "shrink-0 bg-white border-t px-6 py-3" : "shrink-0 bg-white border-t px-4 py-3"}
        style={embedded || useDesktopDialog ? undefined : { paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button type="button" disabled={acting} onClick={rejectAll} className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-semibold text-[13px]">Reject entire claim</button>
      </footer>
    </div>
  );

  if (embedded) return sheet;
  if (useDesktopDialog) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>Approve reimbursement</DialogTitle>
            {teamName ? <p className="text-xs text-primary font-medium">Team · {teamName}</p> : null}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{sheet}</div>
        </DialogContent>
      </Dialog>
    );
  }
  return createPortal(sheet, document.body);
}
