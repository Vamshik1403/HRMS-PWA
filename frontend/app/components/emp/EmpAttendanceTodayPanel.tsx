"use client";

import { useMemo } from "react";
import { Icon } from "@iconify/react";
import type { TodayStatus } from "../../hooks/useEmpPunch";
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
  const punchState = todayStatus?.punchState ?? (todayStatus?.isCheckedIn ? "IN" : "OUT");
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

      </div>

      {isAbsent && (
        <p className="px-4 pb-3 text-[12px] text-gray-600 text-center shrink-0">Marked absent today</p>
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
