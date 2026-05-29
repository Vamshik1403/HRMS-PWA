"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import type { TodayStatus } from "../../hooks/useEmpPunch";
import { useEmpPunch } from "../../hooks/useEmpPunch";

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

interface EmpTodayStatusCardProps {
  todayStatus: TodayStatus | null;
  loading: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
}

export function EmpTodayStatusCard({ todayStatus, loading, onStatusUpdate }: EmpTodayStatusCardProps) {
  const [time, setTime] = useState(new Date());
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
    setPunchSuccess,
  } = useEmpPunch(onStatusUpdate);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = time.getHours().toString().padStart(2, "0");
  const mm = time.getMinutes().toString().padStart(2, "0");
  const ss = time.getSeconds().toString().padStart(2, "0");
  const dateLabel = time.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const punchState = todayStatus?.punchState ?? (todayStatus?.isCheckedIn ? "IN" : "OUT");
  const canCheckIn = todayStatus?.canCheckIn ?? punchState === "OUT";
  const canCheckOut = todayStatus?.canCheckOut ?? punchState === "IN";
  const canBreakIn = todayStatus?.canBreakIn ?? punchState === "IN";
  const canBreakOut = todayStatus?.canBreakOut ?? punchState === "ON_BREAK";
  const isOnBreak = punchState === "ON_BREAK";
  const isAbsent = todayStatus?.isAbsentToday;
  const canMarkAbsent = todayStatus?.canMarkAbsent ?? false;
  const { checkIn, checkOut } = todayStatus || {};

  const submitAbsent = async () => {
    if (absentReason.trim().length < 3) return;
    await markAbsent(absentReason.trim(), absentLeaveType);
    setAbsentOpen(false);
    setAbsentReason("");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Today&apos;s Status</p>
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

      {/* Live clock */}
      <div className="mx-4 mb-3 rounded-xl bg-gray-50/80 border border-gray-100 py-3 flex flex-col items-center">
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Current Time</p>
        <div className="text-[32px] font-bold tabular-nums text-gray-900 leading-none tracking-tight">
          {hh}<span className="text-gray-300">:</span>{mm}<span className="text-gray-300">:</span>{ss}
        </div>
        <p className="text-[12px] text-gray-500 mt-1.5 text-center px-2">{dateLabel}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 mb-3">
        <div className="text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">In</p>
          <p className={`text-sm font-bold tabular-nums ${checkIn ? "text-gray-900" : "text-gray-300"}`}>
            {checkIn ? fmt(checkIn.checkinTime) : "--:--"}
          </p>
        </div>
        <div className="text-center border-x border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Out</p>
          <p className={`text-sm font-bold tabular-nums ${checkOut ? "text-gray-900" : "text-gray-300"}`}>
            {checkOut ? fmt(checkOut.checkinTime) : "--:--"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Break</p>
          <p className="text-sm font-bold tabular-nums text-amber-600">
            {todayStatus?.breakMinutes != null ? `${todayStatus.breakMinutes}m` : "—"}
          </p>
        </div>
      </div>

      {(punchError || punchSuccess) && (
        <div className="px-4 mb-2 space-y-1.5">
          {punchSuccess && (
            <div className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex gap-2">
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{punchSuccess}</span>
            </div>
          )}
          {punchError && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <p>{punchError}</p>
              {punchError.toLowerCase().includes("permission") && (
                <button
                  type="button"
                  onClick={() => { setPunchError(null); requestLocationAccess(); }}
                  disabled={locationLoading}
                  className="mt-2 w-full py-2 rounded-lg bg-white border border-red-200 text-red-700 text-[12px] font-semibold active:scale-[0.98]"
                >
                  {locationLoading ? "Checking…" : "Enable location"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !isAbsent && (
        <div className="px-4 pb-4 space-y-2">
          {canCheckIn && (
            <>
              <button
                type="button"
                onClick={() => punch("CHECK_IN")}
                disabled={punchLoading}
                className="w-full py-3 rounded-xl bg-[#4f46e5] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-200 active:scale-[0.98] disabled:opacity-60"
              >
                <Icon icon="solar:login-bold-duotone" className="w-5 h-5" />
                {punchLoading ? "Please wait…" : "Mark IN"}
              </button>
              {canMarkAbsent && (
                <button
                  type="button"
                  onClick={() => setAbsentOpen(true)}
                  disabled={punchLoading}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-red-200 text-red-600 font-semibold text-sm active:bg-red-50"
                >
                  Mark Absent
                </button>
              )}
            </>
          )}
          {(canCheckOut || canBreakIn || canBreakOut) && (
            <div className={`grid gap-2 ${canCheckOut && (canBreakIn || canBreakOut) ? "grid-cols-2" : "grid-cols-1"}`}>
              {canCheckOut && (
                <button
                  type="button"
                  onClick={() => punch("CHECK_OUT")}
                  disabled={punchLoading}
                  className="py-3 rounded-xl bg-[#4f46e5] text-white font-bold text-sm flex flex-col items-center gap-1 active:scale-[0.98] disabled:opacity-60"
                >
                  <Icon icon="solar:logout-bold-duotone" className="w-6 h-6" />
                  Mark OUT
                </button>
              )}
              {canBreakIn && (
                <button
                  type="button"
                  onClick={() => punch("BREAK_IN")}
                  disabled={punchLoading}
                  className="py-3 rounded-xl bg-amber-500 text-white font-bold text-sm flex flex-col items-center gap-1 active:scale-[0.98] disabled:opacity-60"
                >
                  <Icon icon="solar:cup-hot-bold-duotone" className="w-6 h-6" />
                  Break IN
                </button>
              )}
              {canBreakOut && (
                <button
                  type="button"
                  onClick={() => punch("BREAK_OUT")}
                  disabled={punchLoading}
                  className="py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm flex flex-col items-center gap-1 col-span-full active:scale-[0.98] disabled:opacity-60"
                >
                  <Icon icon="solar:play-bold-duotone" className="w-6 h-6" />
                  Break OUT
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isAbsent && (
        <div className="px-4 pb-4">
          <p className="text-[13px] text-gray-600 text-center py-2">
            Marked absent today
            {todayStatus?.absentDeclaration?.leaveType
              ? ` · Leave type: ${todayStatus.absentDeclaration.leaveType}`
              : ""}
          </p>
        </div>
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
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[14px] mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30"
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
