"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { FormModal } from "../ui/form-modal";
import { EmpTeamStyleDataSection, useTeamListControls } from "./desktop/EmpTeamStyleDataSection";
import { cn } from "@/app/utils/cn";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface SalaryAdvance {
  id: string;
  advanceAmount: string;
  reason: string;
  status: string;
  previousAdvancesDue: string;
  createdAt: string;
}

const STATUS_FILTERS = ["all", "Pending", "Approved", "Rejected", "Paid"];

function statusVariant(status: string): "default" | "destructive" | "warning" | "secondary" | "muted" {
  if (status === "Approved" || status === "Paid") return "default";
  if (status === "Rejected") return "destructive";
  if (status === "Pending") return "secondary";
  return "muted";
}

function SalaryAdvanceTable({ rows }: { rows: SalaryAdvance[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id} className="hover:bg-muted/30">
                <TableCell>{a.createdAt || "—"}</TableCell>
                <TableCell className="font-medium">₹{a.advanceAmount}</TableCell>
                <TableCell className="max-w-xs truncate">{a.reason}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SalaryAdvanceGrid({ rows }: { rows: SalaryAdvance[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((a) => (
        <div
          key={a.id}
          className="rounded-xl border border-border bg-card shadow-sm p-4 hover:border-primary/40 transition-colors"
        >
          <p className="text-xs text-muted-foreground">{a.createdAt || "—"}</p>
          <p className="font-semibold text-foreground mt-1 tabular-nums">₹{a.advanceAmount}</p>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.reason}</p>
          <div className="mt-3">
            <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmpProfileSalaryAdvancePanel() {
  const user = useCurrentUser();
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const listControls = useTeamListControls("emp-profile-advance-view");
  const { viewMode, selectViewMode, searchOpen, searchQuery, setSearchQuery, toggleSearch, filterOpen, toggleFilter } =
    listControls;
  const [formData, setFormData] = useState({
    advanceAmount: "",
    reason: "",
    previousAdvancesDue: "0",
    manageEmployeeID: undefined as number | undefined,
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
  });

  const loadAdvances = useCallback(async (employeeId?: number) => {
    const id = employeeId ?? formData.manageEmployeeID;
    if (!id) return;
    try {
      const response = await fetch(`${BACKEND_URL}/salary-advance`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load");
      const data = await response.json();
      const filtered = (Array.isArray(data) ? data : []).filter(
        (a: { manageEmployeeID?: number }) => a.manageEmployeeID === id,
      );
      setAdvances(
        filtered.map((a: Record<string, unknown>) => ({
          id: String(a.id),
          advanceAmount: String(a.advanceAmount || ""),
          reason: String(a.reason || ""),
          status: String(a.status || "Pending"),
          previousAdvancesDue: String(a.previousAdvancesDue || "0"),
          createdAt: a.createdAt ? new Date(String(a.createdAt)).toISOString().slice(0, 10) : "",
        })),
      );
    } catch {
      setAdvances([]);
    }
  }, [formData.manageEmployeeID]);

  useEffect(() => {
    if (!user?.username) return;
    const load = async () => {
      setLoading(true);
      try {
        const creds = await fetch(
          `${BACKEND_URL}/manage-emp/credentials/${encodeURIComponent(user.username)}`,
        ).then((r) => (r.ok ? r.json() : null));
        const empId = creds?.employee?.id;
        if (!empId) return;
        setFormData((p) => ({
          ...p,
          manageEmployeeID: empId,
          serviceProviderID: creds.serviceProviderID,
          companyID: creds.companyID,
          branchesID: creds.branchesID,
        }));
        await loadAdvances(empId);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.username, loadAdvances]);

  const filtered = useMemo(() => {
    return advances.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        a.reason.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q) ||
        a.advanceAmount.includes(q)
      );
    });
  }, [advances, statusFilter, searchQuery]);

  const submit = async () => {
    if (!formData.advanceAmount || !formData.reason) {
      toast.error("Advance amount and reason are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/salary-advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceProviderID: formData.serviceProviderID,
          companyID: formData.companyID,
          branchesID: formData.branchesID,
          manageEmployeeID: formData.manageEmployeeID,
          previousAdvancesDue: formData.previousAdvancesDue,
          advanceAmount: formData.advanceAmount,
          reason: formData.reason,
          status: "Pending",
        }),
      });
      if (!res.ok) throw new Error("Submit failed");
      toast.success("Salary advance request submitted");
      setApplyOpen(false);
      setFormData((p) => ({ ...p, advanceAmount: "", reason: "" }));
      await loadAdvances();
    } catch {
      toast.error("Could not submit salary advance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormModal
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title="Request salary advance"
        description="Submit a new salary advance request"
      >
        <div className="space-y-4 max-w-2xl">
          <div>
            <Label>Previous advances due</Label>
            <p className="text-sm font-medium mt-1">₹{formData.previousAdvancesDue}</p>
          </div>
          <div>
            <Label htmlFor="advanceAmount">Advance amount *</Label>
            <Input
              id="advanceAmount"
              value={formData.advanceAmount}
              onChange={(e) => setFormData((p) => ({ ...p, advanceAmount: e.target.value }))}
              placeholder="Enter amount"
            />
          </div>
          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Input
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Reason for advance"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="lg" onClick={() => void submit()} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </div>
      </FormModal>

      {!applyOpen ? (
        <EmpTeamStyleDataSection
          title="Salary advances"
          actions={
            <Button type="button" size="sm" onClick={() => setApplyOpen(true)}>
              <Plus className="size-4" />
              New request
            </Button>
          }
          searchOpen={searchOpen}
          onToggleSearch={toggleSearch}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search advances…"
          filterOpen={filterOpen}
          onToggleFilter={toggleFilter}
          filterContent={STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                statusFilter === status
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {status === "all" ? "All" : status}
            </button>
          ))}
          viewMode={viewMode}
          onViewModeChange={selectViewMode}
          loading={loading}
          empty={filtered.length === 0}
          emptyMessage="No salary advances yet."
          listContent={<SalaryAdvanceTable rows={filtered} />}
          gridContent={<SalaryAdvanceGrid rows={filtered} />}
        />
      ) : null}
    </div>
  );
}
