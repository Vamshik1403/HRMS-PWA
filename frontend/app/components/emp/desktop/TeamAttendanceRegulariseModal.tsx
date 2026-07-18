"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { authHeaders } from "@/lib/auth";
import {
  ATTENDANCE_REQUESTED_STATUS_OPTIONS,
  detectAttendanceActualStatus,
} from "@/app/utils/attendanceActualStatus";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatAttendanceDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type EmployeeRecord = {
  id: number;
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
  departmentNameID?: number;
};

type TeamAttendanceRegulariseModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number | null;
  employeeName: string;
  onSuccess?: () => void;
};

export function TeamAttendanceRegulariseModal({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSuccess,
}: TeamAttendanceRegulariseModalProps) {
  const user = useCurrentUser();
  const [attendanceDate] = useState(todayDateString);
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [actualStatus, setActualStatus] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [day, setDay] = useState("");
  const [requestedStatus, setRequestedStatus] = useState("");
  const [reason, setReason] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !employeeId) return;

    let cancelled = false;
    setActualStatus("");
    setRequestedStatus("");
    setReason("");
    setCheckInTime("");
    setCheckOutTime("");
    setDay("");
    setEmployee(null);
    setLoadingStatus(true);

    const load = async () => {
      try {
        const empRes = await fetch(`${BACKEND_URL}/manage-emp/${employeeId}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (!empRes.ok) throw new Error("Failed to load employee");
        const empData: EmployeeRecord = await empRes.json();
        if (cancelled) return;
        setEmployee(empData);

        const status = await detectAttendanceActualStatus({
          employeeId,
          attendanceDate,
          companyID: empData.companyID,
          branchesID: empData.branchesID,
        });
        if (cancelled) return;

        setActualStatus(status.actualStatus);
        setCheckInTime(status.checkInTime);
        setCheckOutTime(status.checkOutTime);
        setDay(status.day);
        if (status.alreadyRegularized) {
          toast.info("This date has already been regularized");
        }
      } catch {
        if (!cancelled) toast.error("Failed to detect attendance status");
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, employeeId, attendanceDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !employee?.branchesID || !employee?.companyID) {
      toast.error("Employee details are incomplete. Please try again.");
      return;
    }
    if (!requestedStatus || !reason.trim()) {
      toast.error("Please select requested status and provide a reason.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        serviceProviderID: employee.serviceProviderID ?? user?.serviceProviderID,
        companyID: employee.companyID,
        branchesID: employee.branchesID,
        manageEmployeeID: employeeId,
        attendanceDate: new Date(attendanceDate),
        day,
        checkInTime: checkInTime ? new Date(`2000-01-01T${checkInTime}`) : null,
        checkOutTime: checkOutTime ? new Date(`2000-01-01T${checkOutTime}`) : null,
        actualStatus: actualStatus ? actualStatus.replace(" (Regularized)", "") : null,
        requestedStatus,
        reason: reason.trim(),
        remarks: null,
        overtimeApplicable: false,
        otMealApply: false,
        otMealMinutes: null,
        otBreakMinutes: null,
      };

      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData?.message || "Failed to regularize attendance");
        return;
      }

      toast.success("Attendance regularized successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("Something went wrong while regularizing attendance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck2 className="size-5 text-primary" />
            Regularize attendance
          </DialogTitle>
          <DialogDescription>
            {employeeName ? `Submit attendance regularization for ${employeeName}.` : "Submit attendance regularization."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Attendance date</Label>
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground">
              {formatAttendanceDateLabel(attendanceDate)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-reg-actual">Actual status (system detected)</Label>
            <div className="relative">
              <Input
                id="team-reg-actual"
                value={loadingStatus ? "Detecting status…" : actualStatus || "—"}
                readOnly
                className="bg-muted pr-10"
              />
              {loadingStatus ? (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-reg-requested">Request to change as *</Label>
            <select
              id="team-reg-requested"
              value={requestedStatus}
              onChange={(e) => setRequestedStatus(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
              disabled={loadingStatus || submitting}
            >
              <option value="">Select requested status</option>
              {ATTENDANCE_REQUESTED_STATUS_OPTIONS.map((opt, index) => (
                <option key={`${opt.value}-${index}`} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-reg-reason">Reason *</Label>
            <textarea
              id="team-reg-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the reason for attendance regularization"
              className="w-full min-h-[80px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
              disabled={submitting}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={loadingStatus || submitting}>
              {submitting ? (
                <>
                  <Clock className="size-4 mr-1 animate-spin" />
                  Regularizing…
                </>
              ) : (
                "Regularize"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
