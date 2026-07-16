"use client";

import { EmpLeaveApprovalSheet } from "./EmpLeaveApprovalSheet";
import { EmpReimbursementApprovalSheet } from "./EmpReimbursementApprovalSheet";
import type { LeaveAppRow } from "./EmpLeaveMobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";

export type TeamApprovalType = "leave" | "reimbursement";

export function EmpTeamApprovalDialog({
  open,
  onClose,
  type,
  onTypeChange,
  leaveApplication,
  reimbursementId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  type: TeamApprovalType;
  onTypeChange: (t: TeamApprovalType) => void;
  leaveApplication: LeaveAppRow | null;
  reimbursementId: string | null;
  onDone: () => void;
}) {
  const lockedType = leaveApplication ? "leave" : reimbursementId ? "reimbursement" : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Review approval</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-3 shrink-0">
          <Label className="text-xs text-muted-foreground">Approval type</Label>
          <div className="mt-1.5 inline-flex rounded-lg border border-border p-1 bg-muted/40">
            <button
              type="button"
              disabled={!!lockedType && lockedType !== "leave"}
              onClick={() => onTypeChange("leave")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                type === "leave" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              } ${lockedType && lockedType !== "leave" ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              Leave
            </button>
            <button
              type="button"
              disabled={!!lockedType && lockedType !== "reimbursement"}
              onClick={() => onTypeChange("reimbursement")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                type === "reimbursement" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              } ${lockedType && lockedType !== "reimbursement" ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              Reimbursement
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
          {type === "leave" && leaveApplication ? (
            <EmpLeaveApprovalSheet
              embedded
              open={open}
              onClose={onClose}
              application={leaveApplication}
              onDone={onDone}
            />
          ) : null}
          {type === "reimbursement" && reimbursementId ? (
            <EmpReimbursementApprovalSheet
              embedded
              open={open}
              onClose={onClose}
              reimbursementId={reimbursementId}
              onDone={onDone}
            />
          ) : null}
          {type === "leave" && !leaveApplication ? (
            <p className="p-6 text-sm text-muted-foreground">Select a leave request to review.</p>
          ) : null}
          {type === "reimbursement" && !reimbursementId ? (
            <p className="p-6 text-sm text-muted-foreground">Select a reimbursement claim to review.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
