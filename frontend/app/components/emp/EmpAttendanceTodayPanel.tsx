"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import type { TodayStatus } from "../../hooks/useEmpPunch";
import { useEmpPunch } from "../../hooks/useEmpPunch";
import {
  extractDayPunchTimes,
  formatLocationLabel,
  formatPunchTime,
} from "../../utils/empAttendanceHistory";
import { formatBreakDuration, formatWorkHoursDecimal } from "../../utils/attendanceDuration";

function formatDuration(minutes?: number, seconds?: number) {
  const totalSec = seconds ?? (minutes ?? 0) * 60;
  if (totalSec <= 0) return "0m";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

interface EmpAttendanceTodayPanelProps {
  todayStatus: TodayStatus | null;
  loading: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
}

export function EmpAttendanceTodayPanel({
  todayStatus,
  loading,
  onStatusUpdate,
}: EmpAttendanceTodayPanelProps) {
  const [absentOpen, setAbsentOpen] = useState(false);
  const [absentReason, setAbsentReason] = useState("");
  const [absentLeaveType, setAbsentLeaveType] = useState("LoP");

  const {
    punch,
    markAbsent,
    requestLocationAccess,
    punchLoading,
    locationLoading,
    punchError,
    punchSuccess,
    setPunchError,
  } = useEmpPunch(onStatusUpdate);

  const punchState = todayStatus?.punchState ?? (todayStatus?.isCheckedIn ? "IN" : "OUT");
  const canCheckIn = todayStatus?.canCheckIn ?? punchState === "OUT";
  const canCheckOut = todayStatus?.canCheckOut ?? punchState === "IN";
  const canBreakIn = todayStatus?.canBreakIn ?? punchState === "IN";
  const canBreakOut = todayStatus?.canBreakOut ?? punchState === "ON_BREAK";
  const isOnBreak = punchState === "ON_BREAK";
  const isAbsent = todayStatus?.isAbsentToday;

  const punches = useMemo(
    () => extractDayPunchTimes((todayStatus?.allToday as any[]) || []),
    [todayStatus?.allToday],
  );

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const submitAbsent = async () => {
    if (absentReason.trim().length < 3) return;
    await markAbsent(absentReason.trim(), absentLeaveType);
    setAbsentOpen(false);
    setAbsentReason("");
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-0 h-full max-h-full">
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2 shrink-0">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">
            Today&apos;s attendance
          </p>
          <p className="text-[12px] text-gray-500 mt-0.5">{dateLabel}</p>
        </div>
        {loading ? (
          <span className="text-[10px] text-gray-300">Loading…</span>
        ) : isAbsent ? (
          <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full uppercase">
            Absent
          </span>
        ) : isOnBreak ? (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full uppercase">
            On Break
          </span>
        ) : punchState === "IN" ? (
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full uppercase">
            Checked In
          </span>
        ) : (
          <span className="text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full uppercase">
            Not In
          </span>
        )}
      </div>

      <div className="px-4 pb-2 overflow-y-auto min-h-0 flex-1">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <StatCell label="Mark IN" value={formatPunchTime(punches.checkIn?.checkinTime)} />
          <StatCell label="Mark OUT" value={formatPunchTime(punches.checkOut?.checkinTime)} />
          <StatCell label="Break IN" value={formatPunchTime(punches.breakIn?.checkinTime)} accent="amber" />
          <StatCell label="Break OUT" value={formatPunchTime(punches.breakOut?.checkinTime)} accent="emerald" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <StatCell
            label="Working hours"
            value={
              todayStatus?.workSeconds != null
                ? formatWorkHoursDecimal(todayStatus.workSeconds)
                : formatDuration(todayStatus?.workMinutes, todayStatus?.workSeconds)
            }
            accent="emerald"
          />
          <StatCell
            label="Break time"
            value={
              todayStatus?.breakSeconds != null
                ? formatBreakDuration(todayStatus.breakSeconds)
                : formatDuration(todayStatus?.breakMinutes, todayStatus?.breakSeconds)
            }
            accent="amber"
          />
        </div>

        <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-3 py-2 mb-2 space-y-1.5">
          <LocationRow
            icon="solar:login-2-bold-duotone"
            label="Mark IN location"
            value={formatLocationLabel(punches.checkIn)}
          />
          <LocationRow
            icon="solar:logout-2-bold-duotone"
            label="Mark OUT location"
            value={formatLocationLabel(punches.checkOut)}
          />
        </div>

        {(punchError || punchSuccess) && (
          <div className="mb-2 space-y-1.5">
            {punchSuccess && (
              <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex gap-2">
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 shrink-0" />
                <span>{punchSuccess}</span>
              </div>
            )}
            {punchError && (
              <div className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                <p>{punchError}</p>
                {punchError.toLowerCase().includes("permission") && (
                  <button
                    type="button"
                    onClick={() => {
                      setPunchError(null);
                      requestLocationAccess();
                    }}
                    disabled={locationLoading}
                    className="mt-2 w-full py-2 rounded-lg bg-white border border-red-200 text-red-700 text-[11px] font-semibold"
                  >
                    {locationLoading ? "Checking…" : "Enable location"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && !isAbsent && (
        <div className="px-4 pb-3 pt-1 space-y-2 shrink-0 border-t border-gray-100">
          {canCheckIn && (
            <>
              <button
                type="button"
                onClick={() => punch("CHECK_IN")}
                disabled={punchLoading}
                className="w-full py-2.5 rounded-xl bg-[#2563eb] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-200 active:scale-[0.98] disabled:opacity-60"
              >
                <Icon icon="solar:login-bold-duotone" className="w-5 h-5" />
                {punchLoading ? "Please wait…" : "Mark IN"}
              </button>
              {todayStatus?.canMarkAbsent && (
                <button
                  type="button"
                  onClick={() => setAbsentOpen(true)}
                  disabled={punchLoading}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-red-200 text-red-600 font-semibold text-xs"
                >
                  Mark Absent
                </button>
              )}
            </>
          )}
          {(canCheckOut || canBreakIn || canBreakOut) && (
            <div
              className={`grid gap-2 ${canCheckOut && (canBreakIn || canBreakOut) ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {canCheckOut && (
                <button
                  type="button"
                  onClick={() => punch("CHECK_OUT")}
                  disabled={punchLoading}
                  className="py-2.5 rounded-xl bg-[#2563eb] text-white font-bold text-xs flex flex-col items-center gap-0.5 disabled:opacity-60"
                >
                  <Icon icon="solar:logout-bold-duotone" className="w-5 h-5" />
                  Mark OUT
                </button>
              )}
              {canBreakIn && (
                <button
                  type="button"
                  onClick={() => punch("BREAK_IN")}
                  disabled={punchLoading}
                  className="py-2.5 rounded-xl bg-amber-500 text-white font-bold text-xs flex flex-col items-center gap-0.5 disabled:opacity-60"
                >
                  <Icon icon="solar:cup-hot-bold-duotone" className="w-5 h-5" />
                  Break IN
                </button>
              )}
              {canBreakOut && (
                <button
                  type="button"
                  onClick={() => punch("BREAK_OUT")}
                  disabled={punchLoading}
                  className="py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex flex-col items-center gap-0.5 col-span-full disabled:opacity-60"
                >
                  <Icon icon="solar:play-bold-duotone" className="w-5 h-5" />
                  Break OUT
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isAbsent && (
        <p className="px-4 pb-3 text-[12px] text-gray-600 text-center shrink-0">Marked absent today</p>
      )}

      {absentOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setAbsentOpen(false)} />
          <div className="fixed inset-x-4 top-[20%] z-50 bg-white rounded-2xl shadow-xl p-5 max-h-[70vh] overflow-y-auto">
            <h3 className="text-[17px] font-bold text-gray-900 mb-1">Mark Absent</h3>
            <p className="text-[12px] text-gray-500 mb-4">
              Emergency absence without prior notice. A leave request will be sent to your manager.
            </p>
            <label className="text-[12px] font-semibold text-gray-600 block mb-1">Leave type</label>
            <select
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-[14px] mb-3"
              value={absentLeaveType}
              onChange={(e) => setAbsentLeaveType(e.target.value)}
            >
              <option value="LoP">Loss of Pay (LoP)</option>
              <option value="Sick">Sick Leave (SL)</option>
              <option value="Casual">Casual Leave (CL)</option>
            </select>
            <label className="text-[12px] font-semibold text-gray-600 block mb-1">Reason *</label>
            <textarea
              value={absentReason}
              onChange={(e) => setAbsentReason(e.target.value)}
              rows={3}
              placeholder="Describe the reason…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[14px] mb-4 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAbsentOpen(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAbsent}
                disabled={punchLoading || absentReason.trim().length < 3}
                className="flex-1 h-11 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-50"
              >
                {punchLoading ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "amber" | "emerald";
}) {
  const valueClass =
    accent === "amber"
      ? "text-amber-600"
      : accent === "emerald"
        ? "text-emerald-600"
        : "text-gray-900";
  return (
    <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-2.5 py-2">
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-[13px] font-bold tabular-nums mt-0.5 ${value === "--:--" ? "text-gray-300" : valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function LocationRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon icon={icon} className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold text-gray-400 uppercase">{label}</p>
        <p className="text-[11px] text-gray-600 font-mono truncate">{value}</p>
      </div>
    </div>
  );
}
