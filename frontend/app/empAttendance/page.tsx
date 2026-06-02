"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { EmpAttendanceTodayPanel } from "../components/emp/EmpAttendanceTodayPanel";
import { EmpAttendanceDayRow } from "../components/emp/EmpAttendanceDayRow";
import { EmpMobileDateField } from "../components/emp/EmpMobileDateField";
import type { TodayStatus } from "../hooks/useEmpPunch";
import { getPageCache, setPageCache } from "../utils/pageCache";
import {
  encodeDateKey,
  filterDaysByCount,
  filterDaysByRange,
  groupAttendanceByDay,
  lastNDaysRange,
  type AttendanceDaySummary,
  type AttendanceLocationRecord,
} from "../utils/empAttendanceHistory";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const HISTORY_DAYS = 7;

export default function EmpAttendancePage() {
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(() =>
    getPageCache<TodayStatus>("todayAttendance"),
  );
  const [statusLoading, setStatusLoading] = useState(!todayStatus);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [allDays, setAllDays] = useState<AttendanceDaySummary[]>([]);
  const [searchDate, setSearchDate] = useState("");

  const getToken = () =>
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";

  const loadStatus = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(
        `${BACKEND}/emp-location-attendance/today?_=${Date.now()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      if (res.ok) {
        const data = await res.json();
        setTodayStatus(data);
        setPageCache("todayAttendance", data);
      }
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setHistoryLoading(true);
    const { from, to } = lastNDaysRange(30);
    try {
      const res = await fetch(`${BACKEND}/emp-location-attendance/my?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data: AttendanceLocationRecord[] = await res.json();
        setAllDays(groupAttendanceByDay(Array.isArray(data) ? data : []));
      }
    } catch {
      setAllDays([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadHistory();
  }, [loadStatus, loadHistory]);

  useEffect(() => {
    const id = setInterval(() => loadStatus(), 30_000);
    return () => clearInterval(id);
  }, [loadStatus]);

  const handleStatusUpdate = useCallback(
    (status: TodayStatus) => {
      setTodayStatus(status);
      setPageCache("todayAttendance", status);
      loadHistory();
    },
    [loadHistory],
  );

  const listDays = useMemo(() => {
    if (searchDate) return filterDaysByRange(allDays, searchDate, searchDate);
    return filterDaysByCount(allDays, HISTORY_DAYS);
  }, [allDays, searchDate]);

  return (
    <EmpMobileLayout>
      <div
        className="flex flex-col px-4 pt-4 overflow-hidden -mx-0"
        style={{
          height: "calc(100dvh - 56px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
          maxHeight: "calc(100dvh - 56px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
        }}
      >
        <h1 className="text-[20px] font-bold text-gray-900 mb-0.5 shrink-0">Attendance</h1>
        <p className="text-[11px] text-gray-500 mb-3 shrink-0">
          Today&apos;s status · last {HISTORY_DAYS} days below
        </p>

        <div className="shrink-0 mb-3 flex-[0_0_48%] min-h-[240px] max-h-[48%]">
          <EmpAttendanceTodayPanel
            todayStatus={todayStatus}
            loading={statusLoading}
            onStatusUpdate={handleStatusUpdate}
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col border-t border-gray-200/80 pt-3">
          <div className="shrink-0 mb-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              History
            </p>
            <EmpMobileDateField
              label="Search by date"
              value={searchDate}
              onChange={setSearchDate}
              max={new Date().toISOString().slice(0, 10)}
            />
            {searchDate ? (
              <button
                type="button"
                onClick={() => setSearchDate("")}
                className="text-[11px] font-semibold text-[#2563eb] mt-1.5"
              >
                Clear · show last {HISTORY_DAYS} days
              </button>
            ) : (
              <p className="text-[10px] text-gray-400 mt-1">Tap a date for full details</p>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-2">
            {historyLoading ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <Icon icon="solar:refresh-bold-duotone" className="w-7 h-7 text-blue-400 animate-spin" />
                <p className="text-[12px] text-gray-400">Loading…</p>
              </div>
            ) : listDays.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <Icon icon="solar:calendar-bold-duotone" className="w-9 h-9 text-gray-200" />
                <p className="text-[12px] text-gray-400">No records</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {listDays.map((day) => (
                  <EmpAttendanceDayRow
                    key={day.dateKey}
                    day={day}
                    compact
                    href={`/empHistory/${encodeDateKey(day.dateKey)}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </EmpMobileLayout>
  );
}
