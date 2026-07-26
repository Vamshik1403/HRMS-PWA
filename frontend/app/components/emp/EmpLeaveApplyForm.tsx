"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { EmpDateField } from "./EmpDateField";
import { EmpMobileDateField } from "./EmpMobileDateField";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export function EmpLeaveApplyForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const user = useCurrentUser();
  const isDesktop = useEmpPortalDesktop();
  const DateField = isDesktop ? EmpDateField : EmpMobileDateField;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [creds, setCreds] = useState<any>(null);

  useEffect(() => {
    if (!user?.username) return;
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCreds)
      .catch(() => {});
  }, [user?.username]);

  const submit = async () => {
    if (!creds?.employee?.id || !fromDate || !toDate || purpose.trim().length < 3) {
      toast.error("Please fill all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/leave-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceProviderID: creds.serviceProviderID,
          companyID: creds.companyID,
          branchesID: creds.branchesID,
          manageEmployeeID: creds.employee.id,
          appliedLeaveType: "",
          fromDate: new Date(fromDate),
          toDate: new Date(toDate),
          purpose: purpose.trim(),
          status: "Pending",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Leave request submitted");
      onSuccess();
    } catch {
      toast.error("Could not submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField label="From date" value={fromDate} onChange={setFromDate} max={toDate || undefined} />
        <DateField label="To date" value={toDate} onChange={setToDate} min={fromDate || undefined} />
      </div>
      <div className="space-y-2">
        <Label>Reason</Label>
        <Textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          rows={4}
          placeholder="Purpose of leave…"
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="button" size="lg" onClick={() => void submit()} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </div>
  );
}
