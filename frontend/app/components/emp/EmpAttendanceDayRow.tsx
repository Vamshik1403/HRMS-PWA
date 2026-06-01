"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import type { AttendanceDaySummary } from "../../utils/empAttendanceHistory";

/** Punch times are stored as wall-clock IST encoded as UTC — read with UTC getters. */
function fmt(iso: string | null) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDateLine(dateKey: string) {
  // dateKey is "YYYY-MM-DD" — append T12:00:00Z to avoid local-tz date shift
  const d = new Date(dateKey + "T12:00:00Z");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function EmpAttendanceDayRow({
  day,
  href,
  compact = false,
}: {
  day: AttendanceDaySummary;
  href?: string;
  compact?: boolean;
}) {
  const status =
    day.checkIn && day.checkOut
      ? { label: "Present", className: "text-emerald-700 bg-emerald-50 border-emerald-100" }
      : day.checkIn
        ? { label: "No Out", className: "text-amber-600 bg-amber-50 border-amber-100" }
        : { label: "Incomplete", className: "text-gray-400 bg-gray-50 border-gray-100" };

  const inner = compact ? (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2.5 flex items-center gap-2 min-h-[44px]">
      <p className="text-[13px] font-semibold text-gray-900 flex-1 min-w-0 truncate">
        {fmtDateLine(day.dateKey)}
      </p>
      <p className="text-[11px] text-gray-500 shrink-0 tabular-nums">
        {fmt(day.checkIn)} – {fmt(day.checkOut)}
      </p>
      {href && <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-300 shrink-0" />}
    </div>
  ) : (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-gray-900 truncate">{fmtDateLine(day.dateKey)}</p>
        <p className="text-[12px] text-gray-500 mt-0.5 truncate">
          In {fmt(day.checkIn)} · Out {fmt(day.checkOut)} · Work {day.workLabel} · Break {day.breakLabel}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide border ${status.className}`}
        >
          {status.label}
        </span>
        {href && <Icon icon="solar:alt-arrow-right-linear" className="w-5 h-5 text-gray-300" />}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block active:scale-[0.99] transition-transform">
        {inner}
      </Link>
    );
  }
  return inner;
}
