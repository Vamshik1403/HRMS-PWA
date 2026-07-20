"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Card, CardContent } from "../ui/card";
import { Search } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface SalaryAdvance {
  id: string;
  advanceAmount: string;
  reason: string;
  status: string;
  previousAdvancesDue: string;
  createdAt: string;
}

export function EmpProfileSalaryAdvancePanel() {
  const user = useCurrentUser();
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        filtered.map((a: any) => ({
          id: String(a.id),
          advanceAmount: a.advanceAmount || "",
          reason: a.reason || "",
          status: a.status || "Pending",
          previousAdvancesDue: a.previousAdvancesDue || "0",
          createdAt: a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : "",
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

  const filtered = advances.filter(
    (a) =>
      a.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.advanceAmount.includes(searchTerm),
  );

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

  if (applyOpen) {
    return (
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
            <Button type="button" onClick={() => void submit()} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setApplyOpen(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      </FormModal>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Salary advances</h3>
          <p className="text-sm text-muted-foreground">Request and track salary advance payments</p>
        </div>
        <Button type="button" onClick={() => setApplyOpen(true)}>
          <Plus className="size-4" />
          New request
        </Button>
      </div>

      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search advances…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No salary advances yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.createdAt || "—"}</TableCell>
                      <TableCell className="font-medium">₹{a.advanceAmount}</TableCell>
                      <TableCell className="max-w-xs truncate">{a.reason}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
