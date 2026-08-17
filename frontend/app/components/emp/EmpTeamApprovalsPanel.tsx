"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { CheckCircle, Plus } from "lucide-react";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { isTeamMemberId, nameForEmployeeId } from "@/app/utils/empManagerDisplay";
import { getDisplayLeaveStatus } from "@/app/utils/leaveDisplay";
import { isPartiallyApprovedStatus } from "@/app/utils/statusDisplay";
import { getPageCache, setPageCache } from "@/app/utils/pageCache";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { EmpTeamApprovalDialog, type TeamApprovalType } from "./EmpTeamApprovalDialog";
import { EmpSelfApprovalRequestInline } from "./EmpSelfApprovalRequestDialog";
import type { LeaveAppRow } from "./EmpLeaveMobile";
import type { ReimbursementRow } from "./EmpReimbursementMobile";
import { totalAmount } from "./EmpReimbursementMobile";
import { Button } from "../ui/button";
import { cn } from "@/app/utils/cn";
import { useRouter } from "next/navigation";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type FilterType = "all" | "leave" | "reimbursement";

type UnifiedRow =
  | { kind: "leave"; id: string; employeeName: string; subtitle: string; leave: LeaveAppRow; isOwn?: boolean }
  | {
      kind: "reimbursement";
      id: string;
      employeeName: string;
      subtitle: string;
      reimb: ReimbursementRow;
      isOwn?: boolean;
    };

export type EmpApprovalsPanelProps = {
  title?: string;
  description?: string;
  emptyMessage?: string;
  noAccessMessage?: string;
  includeOwnSubmissions?: boolean;
  /** Show "New request" form modal for self leave / reimbursement / promotion requests */
  allowNewRequest?: boolean;
  /** When true, omit nested page header (e.g. inside My Profile workspace). */
  embedded?: boolean;
};

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function EmpTeamApprovalsPanel({
  title = "Team Approvals",
  description = "Approve leave and reimbursement for your reportees",
  emptyMessage = "No pending team approvals.",
  noAccessMessage = "You do not have team approval access.",
  includeOwnSubmissions = false,
  allowNewRequest = false,
  embedded = false,
}: EmpApprovalsPanelProps = {}) {
  const isDesktop = useEmpPortalDesktop();
  const user = useCurrentUser();
  const { scope, isManagerView, loading: scopeLoading } = useEmpManagerScope();
  const [filter, setFilter] = useState<FilterType>("all");
  const [leaveApps, setLeaveApps] = useState<LeaveAppRow[]>([]);
  const [reimbRows, setReimbRows] = useState<ReimbursementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<TeamApprovalType>("leave");
  const [selectedLeave, setSelectedLeave] = useState<LeaveAppRow | null>(null);
  const [selectedReimbId, setSelectedReimbId] = useState<string | null>(null);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async (empId: number) => {
    setLoading(true);
    try {
      const [leaveRes, reimbRes] = await Promise.all([
        fetch(`${BACKEND}/leave-application/employee/${empId}`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${BACKEND}/reimbursement/employee/${empId}`, { headers: authHeaders(), cache: "no-store" }),
      ]);
      const leaveData = leaveRes.ok ? await leaveRes.json() : [];
      const reimbData = reimbRes.ok ? await reimbRes.json() : [];

      const mappedLeave = (Array.isArray(leaveData) ? leaveData : []).map((a: any) => ({
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
      }));
      setPageCache("empLeaveApps", mappedLeave);
      setLeaveApps(mappedLeave);

      const mappedReimb = (Array.isArray(reimbData) ? reimbData : []).map((r: any) => {
        const items =
          Array.isArray(r.items) && r.items.length > 0
            ? r.items.map((i: any) => ({
                id: i.id,
                reimbursementType: i.reimbursementType,
                amount: i.amount,
                description: i.description,
                status: i.status || "Pending",
              }))
            : [];
        return {
          id: String(r.id),
          date: r.date || "",
          taskProjectID: r.taskProjectID ?? null,
          amount: items.reduce((s: number, i: any) => s + parseFloat(i.amount || "0"), 0),
          status: r.status || "Pending",
          items,
          manageEmployeeID: r.manageEmployeeID,
          manageEmployee: r.manageEmployee,
        };
      });
      setPageCache("empReimbursements", mappedReimb);
      setReimbRows(mappedReimb);
    } finally {
      setLoading(false);
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
          void loadData(id);
        } else setLoading(false);
      });
  }, [user, loadData]);

  const employeeName = (manageEmployeeID?: number, manageEmployee?: LeaveAppRow["manageEmployee"]) => {
    if (manageEmployee) {
      const n = [manageEmployee.employeeFirstName, manageEmployee.employeeLastName].filter(Boolean).join(" ").trim();
      if (n) return n;
    }
    return nameForEmployeeId(scope, manageEmployeeID) || "Team member";
  };

  const pendingLeave = useMemo(
    () =>
      leaveApps.filter(
        (a) =>
          isTeamMemberId(scope, a.manageEmployeeID) &&
          getDisplayLeaveStatus(a.status, a.dayStatuses) === "Approval Pending",
      ),
    [leaveApps, scope],
  );

  const pendingOwnLeave = useMemo(
    () =>
      leaveApps.filter(
        (a) =>
          employeeId != null &&
          a.manageEmployeeID === employeeId &&
          getDisplayLeaveStatus(a.status, a.dayStatuses) === "Approval Pending",
      ),
    [leaveApps, employeeId],
  );

  const pendingReimb = useMemo(
    () =>
      reimbRows.filter((r) => {
        if (!isTeamMemberId(scope, r.manageEmployeeID)) return false;
        const hasPendingItems = (r.items || []).some((i) => (i.status || "Pending") === "Pending");
        return r.status === "Pending" || (isPartiallyApprovedStatus(r.status) && hasPendingItems);
      }),
    [reimbRows, scope],
  );

  const pendingOwnReimb = useMemo(
    () =>
      reimbRows.filter((r) => {
        if (employeeId == null || r.manageEmployeeID !== employeeId) return false;
        const hasPendingItems = (r.items || []).some((i) => (i.status || "Pending") === "Pending");
        return r.status === "Pending" || (isPartiallyApprovedStatus(r.status) && hasPendingItems);
      }),
    [reimbRows, employeeId],
  );

  const canReviewTeam = isManagerView;
  const showOwnSubmissions = includeOwnSubmissions || !canReviewTeam;

  const unified: UnifiedRow[] = useMemo(() => {
    const leaveRows: UnifiedRow[] = (canReviewTeam ? pendingLeave : []).map((l) => ({
      kind: "leave",
      id: `leave-${l.id}`,
      employeeName: employeeName(l.manageEmployeeID, l.manageEmployee),
      subtitle: `${l.fromDate} → ${l.toDate}${l.purpose ? ` · ${l.purpose}` : ""}`,
      leave: l,
      isOwn: false,
    }));
    const reimbUnified: UnifiedRow[] = (canReviewTeam ? pendingReimb : []).map((r) => ({
      kind: "reimbursement",
      id: `reimb-${r.id}`,
      employeeName: employeeName(r.manageEmployeeID, r.manageEmployee),
      subtitle: `${r.date || "—"} · ₹${totalAmount(r).toFixed(2)}`,
      reimb: r,
      isOwn: false,
    }));
    const ownLeaveRows: UnifiedRow[] = (showOwnSubmissions ? pendingOwnLeave : []).map((l) => ({
      kind: "leave",
      id: `own-leave-${l.id}`,
      employeeName: "You",
      subtitle: `${l.fromDate} → ${l.toDate}${l.purpose ? ` · ${l.purpose}` : ""}`,
      leave: l,
      isOwn: true,
    }));
    const ownReimbRows: UnifiedRow[] = (showOwnSubmissions ? pendingOwnReimb : []).map((r) => ({
      kind: "reimbursement",
      id: `own-reimb-${r.id}`,
      employeeName: "You",
      subtitle: `${r.date || "—"} · ₹${totalAmount(r).toFixed(2)}`,
      reimb: r,
      isOwn: true,
    }));
    return [...leaveRows, ...reimbUnified, ...ownLeaveRows, ...ownReimbRows].sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName),
    );
  }, [
    canReviewTeam,
    pendingLeave,
    pendingReimb,
    showOwnSubmissions,
    pendingOwnLeave,
    pendingOwnReimb,
    scope,
  ]);

  const filtered = unified.filter((row) => filter === "all" || row.kind === filter);

  const openReview = (row: UnifiedRow) => {
    if (row.isOwn) return;
    if (row.kind === "leave") {
      setDialogType("leave");
      setSelectedLeave(row.leave);
      setSelectedReimbId(null);
    } else {
      setDialogType("reimbursement");
      setSelectedReimbId(row.reimb.id);
      setSelectedLeave(null);
    }
    setDialogOpen(true);
  };

  const content = newRequestOpen ? (
    <EmpSelfApprovalRequestInline
      open={newRequestOpen}
      onOpenChange={setNewRequestOpen}
      onSubmitted={() => {
        if (employeeId) void loadData(employeeId);
      }}
    />
  ) : (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
       <div className="flex flex-wrap items-center gap-2">
  {(["all", "leave", "reimbursement"] as FilterType[]).map((f) => (
    <Button
      key={f}
      type="button"
      size="sm"
      variant={filter === f ? "default" : "outline"}
      onClick={() => setFilter(f)}
    >
      {f === "all" ? "All" : f === "leave" ? "Leave" : "Reimbursement"}
    </Button>
  ))}

  <Button
  type="button"
  size="sm"
  variant="outline"
  onClick={() => router.push("/empTeam/regularisation")}
>
  Regularization
</Button>
</div>
        {allowNewRequest ? (
          <Button type="button" onClick={() => setNewRequestOpen(true)}>
            <Plus className="size-4" />
            New request
          </Button>
        ) : null}
      </div>

      {loading || scopeLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading approvals…</p>
      ) : !canReviewTeam && !showOwnSubmissions ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          {noAccessMessage}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span
                  className={cn(
                    "shrink-0 size-9 rounded-md flex items-center justify-center",
                    row.kind === "leave" ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600",
                  )}
                >
                  <Icon
                    icon={row.kind === "leave" ? "solar:calendar-bold-duotone" : "solar:wallet-bold-duotone"}
                    className="size-5"
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                    {row.kind === "leave" ? "Leave" : "Reimbursement"}
                    {row.isOwn ? " · Your request" : ""}
                  </p>
                  <p className="font-semibold text-foreground truncate">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{row.subtitle}</p>
                </div>
              </div>
              {row.isOwn ? (
                <span className="text-xs font-medium text-amber-600 shrink-0">Awaiting approval</span>
              ) : (
                <Button type="button" size="sm" className="shrink-0" onClick={() => openReview(row)}>
                  Review
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <EmpTeamApprovalDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        type={dialogType}
        onTypeChange={setDialogType}
        leaveApplication={selectedLeave}
        reimbursementId={selectedReimbId}
        onDone={() => {
          if (employeeId) void loadData(employeeId);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("emp-sidebar-badges-changed"));
          }
        }}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  if (isDesktop) {
    return (
      <EmpDesktopPage title={title} description={description} icon={CheckCircle}>
        {content}
      </EmpDesktopPage>
    );
  }

  return (
    <div className="space-y-4 px-4 py-2">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      {content}
    </div>
  );
}
