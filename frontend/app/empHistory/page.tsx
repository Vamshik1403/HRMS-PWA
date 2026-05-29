"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpAttendanceDayRow } from "../components/emp/EmpAttendanceDayRow";
import { EmpMobileDateField } from "../components/emp/EmpMobileDateField";
import {
  encodeDateKey,
  filterDaysByCount,
  filterDaysByRange,
  groupAttendanceByDay,
  type AttendanceDaySummary,
  type AttendanceLocationRecord,
} from "../utils/empAttendanceHistory";
import { formatWorkHoursDecimal } from "../utils/attendanceDuration";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const DEFAULT_DAYS = 7;

export default function EmpHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allDays, setAllDays] = useState<AttendanceDaySummary[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    if (!token) {
      router.replace("/login");
      return;
    }
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    fetch(`${BACKEND}/emp-location-attendance/my?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("accessToken");
            router.replace("/login");
          }
          return Promise.reject(r.status);
        }
        return r.json();
      })
      .then((data: AttendanceLocationRecord[]) => {
        if (!Array.isArray(data)) return;
        setAllDays(groupAttendanceByDay(data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fromDate, toDate, router]);

  const displayDays = useMemo(() => {
    const ranged = filterDaysByRange(allDays, fromDate, toDate);
    if (fromDate || toDate) return ranged;
    return filterDaysByCount(ranged, DEFAULT_DAYS);
  }, [allDays, fromDate, toDate]);

  const presentDays = displayDays.filter((d) => d.checkIn && d.checkOut).length;
  const totalHours = formatWorkHoursDecimal(
    displayDays.reduce((s, d) => s + d.workSeconds, 0),
  );

  const clearRange = () => {
    setFromDate("");
    setToDate("");
  };

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-6 pb-6">
        <h1 className="text-[22px] font-bold text-gray-900 mb-1">Attendance History</h1>
        <p className="text-[12px] text-gray-500 mb-4">
          Last {DEFAULT_DAYS} days · tap a date for details · use calendar for a custom range
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date range</p>
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
            <EmpMobileDateField label="From" value={fromDate} onChange={setFromDate} max={toDate || undefined} />
            <EmpMobileDateField label="To" value={toDate} onChange={setToDate} min={fromDate || undefined} />
          </div>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={clearRange}
              className="text-[12px] font-semibold text-[#2563eb]"
            >
              Clear range · show last {DEFAULT_DAYS} days
            </button>
          )}
        </div>

        {!loading && displayDays.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[28px] font-bold text-gray-900 leading-none">{presentDays}</p>
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-1">
                Present Days
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[28px] font-bold text-gray-900 leading-none">{totalHours}</p>
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-1">
                Total Hours
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-[13px] text-gray-400">Loading history…</p>
          </div>
        ) : displayDays.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Icon icon="solar:calendar-bold-duotone" className="w-10 h-10 text-gray-200" />
            <p className="text-[13px] text-gray-400 font-medium">No attendance in this range</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayDays.map((day) => (
              <EmpAttendanceDayRow
                key={day.dateKey}
                day={day}
                href={`/empHistory/${encodeDateKey(day.dateKey)}`}
              />
            ))}
          </div>
        )}
      </div>
    </EmpMobileLayout>
  );
}
