"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import {
  applyLeaveTypeToRange,
  buildDayStatusesFromRange,
  buildLeaveApprovalPayload,
  clearLeaveTypeInRange,
  enforceBalanceOnDayStatuses,
  groupAssignedRanges,
  leaveTypeLabel,
  toggleDayLeaveType,
  type LeaveBalance,
  type LeaveDayStatus,
  availableLeaveTypesForEmployee,
} from "../../utils/leaveApprovalLogic";
import { fetchEmployeeLeaveBalance } from "../../utils/leaveApprovalApi";
import { formatDateShort } from "../../utils/leaveDisplay";
import { EmpMobileDateField } from "./EmpMobileDateField";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function EmpLeaveApprovalSheet({
  open,
  onClose,
  application,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  application: {
    id: string | number;
    fromDate: string;
    toDate: string;
    manageEmployeeID?: number;
    purpose?: string;
  } | null;
  onDone: () => void;
}) {
  const [dayStatuses, setDayStatuses] = useState<LeaveDayStatus[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeType, setRangeType] = useState("");
  const [rangeDayType, setRangeDayType] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const periodFrom = application?.fromDate.slice(0, 10) ?? "";
  const periodTo = application?.toDate.slice(0, 10) ?? "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !application?.manageEmployeeID) return;
    setDayStatuses(buildDayStatusesFromRange(periodFrom, periodTo));
    setRangeFrom(periodFrom);
    setRangeTo(periodTo);
    setRangeType("");
    setRangeDayType("");
    setLoading(true);
    fetchEmployeeLeaveBalance(application.manageEmployeeID)
      .then(({ balance: b, gender }) => {
        setBalance(b);
        setTypes(availableLeaveTypesForEmployee(b, gender));
      })
      .finally(() => setLoading(false));
  }, [open, application, periodFrom, periodTo]);

  const pendingCount = useMemo(() => dayStatuses.filter((d) => !d.status).length, [dayStatuses]);
  const assignedCount = useMemo(() => dayStatuses.filter((d) => d.status).length, [dayStatuses]);
  const segments = useMemo(() => groupAssignedRanges(dayStatuses), [dayStatuses]);

  if (!open || !application || !mounted) return null;

  const applyRange = () => {
    if (!balance) {
      toast.error("Leave balance not loaded.");
      return;
    }
    if (!rangeType) {
      toast.error("Select a leave type.");
      return;
    }
    if (!rangeFrom || !rangeTo) {
      toast.error("Select from and to dates.");
      return;
    }
    if (rangeType === "ShortLeave" && !rangeDayType) {
      toast.error("Select how short leave should be marked.");
      return;
    }
    const { days, assigned, skipped } = applyLeaveTypeToRange(
      dayStatuses,
      rangeFrom,
      rangeTo,
      rangeType as LeaveDayStatus["status"],
      balance,
      (rangeDayType as LeaveDayStatus["dayType"]) || undefined,
    );
    setDayStatuses(days);
    if (assigned === 0) toast.error("No days assigned — balance may be exhausted.");
    else if (skipped > 0) {
      toast.warning(`Assigned ${assigned} day(s); ${skipped} left unassigned (insufficient balance).`);
    } else {
      toast.success(`Assigned ${assigned} day(s).`);
    }
  };

  const applyToFullPeriod = () => {
    if (!balance) {
      toast.error("Leave balance not loaded.");
      return;
    }
    if (!rangeType) {
      toast.error("Select a leave type first.");
      return;
    }
    if (rangeType === "ShortLeave" && !rangeDayType) {
      toast.error("Select how short leave should be marked.");
      return;
    }
    const { days, assigned, skipped } = applyLeaveTypeToRange(
      dayStatuses,
      periodFrom,
      periodTo,
      rangeType as LeaveDayStatus["status"],
      balance,
      (rangeDayType as LeaveDayStatus["dayType"]) || undefined,
    );
    setDayStatuses(days);
    setRangeFrom(periodFrom);
    setRangeTo(periodTo);
    if (skipped > 0) {
      toast.warning(
        `Applied to ${assigned} of ${dayStatuses.length} day(s) — insufficient balance for the rest.`,
      );
    } else {
      toast.success(`Applied to full requested period (${assigned} day(s)).`);
    }
  };

  const onDayTap = (date: string) => {
    if (!rangeType) {
      toast.error("Select a leave type above, then tap days to assign.");
      return;
    }
    if (rangeType === "ShortLeave" && !rangeDayType) {
      toast.error("Select how short leave should be marked.");
      return;
    }
    setDayStatuses((prev) =>
      toggleDayLeaveType(
        prev,
        date,
        rangeType as LeaveDayStatus["status"],
        (rangeDayType as LeaveDayStatus["dayType"]) || undefined,
      ),
    );
  };

  const submit = async () => {
    if (!balance) {
      toast.error("Leave balance not loaded.");
      return;
    }
    const { days: balancedDays, stripped } = enforceBalanceOnDayStatuses(dayStatuses, balance);
    if (stripped > 0) {
      setDayStatuses(balancedDays);
      toast.error(`${stripped} day(s) exceed balance.`);
      return;
    }
    if (!balancedDays.some((d) => d.status)) {
      toast.error("Assign at least one day or reject the request.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...buildLeaveApprovalPayload(balancedDays, balance),
        actorRole: "MANAGER",
      };
      const res = await fetch(`${BACKEND}/leave-application/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Approval failed");
      }
      const assigned = balancedDays.filter((d) => d.status).length;
      toast.success(
        payload.status === "Partially Approved"
          ? `Partially approved: ${assigned} of ${balancedDays.length} day(s). Unassigned days are not approved.`
          : "Leave approved for all requested days.",
      );
      onDone();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async () => {
    if (!confirm("Reject this leave request?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/leave-application/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "Rejected", actorRole: "MANAGER" }),
      });
      if (!res.ok) throw new Error("Reject failed");
      toast.success("Leave rejected");
      onDone();
      onClose();
    } catch {
      toast.error("Could not reject leave");
    } finally {
      setSubmitting(false);
    }
  };

  const sheet = (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[#f8f9fb]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <header className="shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
        <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center">
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[16px] font-bold text-gray-900">Approve leave</h1>
          <p className="text-[11px] text-gray-500 truncate">
            {formatDateShort(application.fromDate)} – {formatDateShort(application.toDate)}
          </p>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
        {loading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Loading balance…</p>
        ) : !balance ? (
          <p className="text-center text-gray-400 py-8 text-sm">Could not load leave balance.</p>
        ) : (
          <>
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
              Assign leave types by date range or tap individual days.{" "}
              <strong>Unassigned days will not be approved</strong> (same as desktop).
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[
                { k: "sick", l: "Sick" },
                { k: "casual", l: "Casual" },
                { k: "privileged", l: "Privilege" },
              ].map(({ k, l }) => (
                <div key={k} className="bg-white rounded-xl border p-2 text-center text-[11px]">
                  <p className="text-gray-500">{l}</p>
                  <p className="font-bold text-gray-900">
                    {balance[k as keyof LeaveBalance].remaining}/{balance[k as keyof LeaveBalance].total}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border p-3 space-y-3 min-w-0 overflow-hidden">
              <p className="text-[12px] font-bold text-gray-700">Assign by date range</p>
              <div className="grid grid-cols-2 gap-2 min-w-0">
                <EmpMobileDateField
                  label="From"
                  value={rangeFrom}
                  min={periodFrom}
                  max={periodTo}
                  onChange={setRangeFrom}
                />
                <EmpMobileDateField
                  label="To"
                  value={rangeTo}
                  min={periodFrom}
                  max={periodTo}
                  onChange={setRangeTo}
                />
              </div>
              <select
                className="app-form-control w-full min-w-0 h-11 px-3 rounded-xl border border-gray-200 bg-white text-[13px]"
                value={rangeType}
                onChange={(e) => setRangeType(e.target.value)}
              >
                <option value="">Leave type</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {leaveTypeLabel(t)}
                  </option>
                ))}
              </select>
              {rangeType === "ShortLeave" && (
                <select
                  className="app-form-control w-full min-w-0 h-11 px-3 rounded-xl border border-gray-200 bg-white text-[13px]"
                  value={rangeDayType}
                  onChange={(e) => setRangeDayType(e.target.value)}
                >
                  <option value="">Mark as…</option>
                  <option value="Present">Present</option>
                  <option value="LateMark">Late Mark</option>
                  <option value="Halfday">Half Day</option>
                  <option value="Absent">Absent</option>
                </select>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyRange}
                  className="px-3 py-1.5 rounded-lg bg-[#2563eb] text-white text-[12px] font-semibold"
                >
                  Apply to range
                </button>
                <button
                  type="button"
                  onClick={() => setDayStatuses(clearLeaveTypeInRange(dayStatuses, rangeFrom, rangeTo))}
                  className="px-3 py-1.5 rounded-lg border text-[12px] font-semibold"
                >
                  Clear range
                </button>
                <button
                  type="button"
                  onClick={applyToFullPeriod}
                  className="px-3 py-1.5 rounded-lg border text-[12px] font-semibold"
                >
                  Apply to full period
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 text-[11px] font-bold text-gray-500 flex justify-between">
                <span>Day-wise (tap to assign)</span>
                <span>
                  {assignedCount}/{dayStatuses.length}
                </span>
              </div>
              <div className="max-h-[220px] overflow-y-auto divide-y divide-gray-50">
                {dayStatuses.map((day) => {
                  const assigned = !!day.status;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => onDayTap(day.date)}
                      className={`w-full px-3 py-2.5 flex items-center justify-between text-left text-[12px] active:bg-gray-50 ${
                        assigned ? "bg-emerald-50/80" : ""
                      }`}
                    >
                      <span className="text-gray-800">{formatDateShort(day.date)}</span>
                      <span
                        className={`font-semibold shrink-0 ml-2 ${
                          assigned ? "text-emerald-700" : "text-gray-400"
                        }`}
                      >
                        {assigned
                          ? leaveTypeLabel(day.status) +
                            (day.status === "ShortLeave" && day.dayType ? ` (${day.dayType})` : "")
                          : "Not approved"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {segments.length > 0 && (
                <div className="border-t border-gray-100 px-3 py-2 space-y-1">
                  {segments.map((seg, i) => (
                    <p key={i} className="text-[11px] text-gray-600">
                      {formatDateShort(seg.from)} – {formatDateShort(seg.to)} · {leaveTypeLabel(seg.status)} (
                      {seg.count}d)
                    </p>
                  ))}
                </div>
              )}
              {pendingCount > 0 && (
                <p className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50 border-t">
                  {pendingCount} day(s) will not be approved.
                </p>
              )}
            </div>

            {assignedCount > 0 && (
              <button
                type="button"
                disabled={submitting || loading || !balance}
                onClick={submit}
                className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-[14px] disabled:opacity-50 shadow-sm"
              >
                {submitting
                  ? "Approving…"
                  : pendingCount > 0
                    ? `Submit partial approval (${assignedCount} day${assignedCount === 1 ? "" : "s"})`
                    : `Approve all ${assignedCount} day(s)`}
              </button>
            )}
          </>
        )}
      </div>

      <footer
        className="shrink-0 bg-white border-t px-4 py-3 grid grid-cols-3 gap-2"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          disabled={submitting}
          onClick={reject}
          className="py-3 rounded-xl border border-red-200 text-red-600 font-semibold text-[13px]"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          className="py-3 rounded-xl border font-semibold text-[13px]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting || loading || assignedCount === 0}
          onClick={submit}
          className="py-3 rounded-xl bg-emerald-600 text-white font-semibold text-[13px] disabled:opacity-50"
        >
          {submitting ? "…" : "Submit"}
        </button>
      </footer>
    </div>
  );

  return createPortal(sheet, document.body);
}
