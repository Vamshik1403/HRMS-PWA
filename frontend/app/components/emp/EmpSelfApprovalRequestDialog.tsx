"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { FormModal } from "../ui/form-modal";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const REIMB_CATEGORIES = ["Travelling", "Food", "Accommodation", "Consumables", "Other"] as const;

export type SelfApprovalFormType = "leave" | "reimbursement" | "promotion";

type Creds = {
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
  employee?: { id: number };
};

export function EmpSelfApprovalRequestForm({
  onSubmitted,
  onCancel,
}: {
  onSubmitted?: () => void;
  onCancel?: () => void;
}) {
  const user = useCurrentUser();
  const [creds, setCreds] = useState<Creds | null>(null);
  const [formType, setFormType] = useState<SelfApprovalFormType>("leave");
  const [submitting, setSubmitting] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [leavePurpose, setLeavePurpose] = useState("");

  const [reimbType, setReimbType] = useState<string>(REIMB_CATEGORIES[0]);
  const [reimbAmount, setReimbAmount] = useState("");
  const [reimbDescription, setReimbDescription] = useState("");

  const [promotionKind, setPromotionKind] = useState<"promotion" | "transfer">("promotion");
  const [promotionDate, setPromotionDate] = useState("");
  const [promotionDescription, setPromotionDescription] = useState("");

  useEffect(() => {
    if (!user?.username) return;
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCreds)
      .catch(() => setCreds(null));
  }, [user?.username]);

  const submit = async () => {
    if (!creds?.employee?.id) {
      toast.error("Employee profile not loaded. Please try again.");
      return;
    }

    if (formType === "leave") {
      if (!fromDate || !toDate || leavePurpose.trim().length < 3) {
        toast.error("Please fill in leave dates and a reason (min. 3 characters).");
        return;
      }
    } else if (formType === "reimbursement") {
      const amount = parseFloat(reimbAmount);
      if (!amount || amount <= 0) {
        toast.error("Please enter a valid reimbursement amount.");
        return;
      }
    } else if (!promotionDate || promotionDescription.trim().length < 10) {
      toast.error("Please provide an effective date and a detailed reason (min. 10 characters).");
      return;
    }

    setSubmitting(true);
    try {
      if (formType === "leave") {
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
            purpose: leavePurpose.trim(),
            status: "Pending",
          }),
        });
        if (!res.ok) throw new Error("Failed to submit leave request");
        toast.success("Leave request submitted");
      } else if (formType === "reimbursement") {
        const amount = parseFloat(reimbAmount);
        const res = await fetch(`${BACKEND}/reimbursement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceProviderID: creds.serviceProviderID,
            companyID: creds.companyID,
            branchesID: creds.branchesID,
            manageEmployeeID: creds.employee.id,
            date: new Date().toISOString().slice(0, 10),
            status: "Pending",
            items: [
              {
                reimbursementType: reimbType,
                amount: String(amount),
                description: reimbDescription.trim() || undefined,
              },
            ],
          }),
        });
        if (!res.ok) throw new Error("Failed to submit reimbursement");
        toast.success("Reimbursement request submitted");
      } else {
        const label = promotionKind === "transfer" ? "Transfer" : "Promotion";
        const res = await fetch(`${BACKEND}/emp-promotion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manageEmployeeID: creds.employee.id,
            serviceProviderID: creds.serviceProviderID,
            companyID: creds.companyID,
            branchesID: creds.branchesID,
            description: `[${label} request] ${promotionDescription.trim()}`,
            promotionDate,
            status: "Applied",
          }),
        });
        if (!res.ok) throw new Error("Failed to submit request");
        toast.success(`${label} request submitted`);
      }

      onCancel?.();
      onSubmitted?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Request type</Label>
          <Select value={formType} onValueChange={(v) => setFormType(v as SelfApprovalFormType)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose request type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="leave">Leave</SelectItem>
              <SelectItem value="reimbursement">Reimbursement</SelectItem>
              <SelectItem value="promotion">Promotion &amp; Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formType === "leave" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leave-from">From date</Label>
                <Input
                  id="leave-from"
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave-to">To date</Label>
                <Input
                  id="leave-to"
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-purpose">Reason</Label>
              <Textarea
                id="leave-purpose"
                value={leavePurpose}
                onChange={(e) => setLeavePurpose(e.target.value)}
                placeholder="Describe the reason for your leave"
                rows={3}
              />
            </div>
          </div>
        ) : null}

        {formType === "reimbursement" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={reimbType} onValueChange={setReimbType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REIMB_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reimb-amount">Amount (₹)</Label>
              <Input
                id="reimb-amount"
                type="number"
                min="0"
                step="0.01"
                value={reimbAmount}
                onChange={(e) => setReimbAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reimb-desc">Description (optional)</Label>
              <Textarea
                id="reimb-desc"
                value={reimbDescription}
                onChange={(e) => setReimbDescription(e.target.value)}
                placeholder="Add expense details"
                rows={2}
              />
            </div>
          </div>
        ) : null}

        {formType === "promotion" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Request for</Label>
              <Select
                value={promotionKind}
                onValueChange={(v) => setPromotionKind(v as "promotion" | "transfer")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="promotion">Promotion</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-date">Requested effective date</Label>
              <Input
                id="promo-date"
                type="date"
                value={promotionDate}
                onChange={(e) => setPromotionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-desc">Reason &amp; details</Label>
              <Textarea
                id="promo-desc"
                value={promotionDescription}
                onChange={(e) => setPromotionDescription(e.target.value)}
                placeholder="Explain why you are requesting a promotion or transfer"
                rows={4}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void submit()} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </div>
  );
}

export function EmpSelfApprovalRequestInline({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}) {
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="New approval request"
      description="Submit a leave, reimbursement, or promotion request"
      showBackButton
      backLabel="Back to approvals"
      closeLabel="Cancel"
    >
      <EmpSelfApprovalRequestForm
        onSubmitted={onSubmitted}
        onCancel={() => onOpenChange(false)}
      />
    </FormModal>
  );
}

export function EmpSelfApprovalRequestButton({ onSubmitted }: { onSubmitted?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New request
      </Button>
      <EmpSelfApprovalRequestInline open={open} onOpenChange={setOpen} onSubmitted={onSubmitted} />
    </>
  );
}
