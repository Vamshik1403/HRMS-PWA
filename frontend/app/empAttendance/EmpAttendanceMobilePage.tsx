"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { EmpAttendanceTodayPanel } from "../components/emp/EmpAttendanceTodayPanel";
import { EmpAttendanceDayRow } from "../components/emp/EmpAttendanceDayRow";
import { EmpMobileDateField } from "../components/emp/EmpMobileDateField";
import type { TodayStatus } from "../hooks/useEmpPunch";
import { getPageCache, setPageCache } from "../utils/pageCache";
import {
  encodeDateKey,
  filterDaysByRange,
  groupAttendanceByDay,
  lastNDaysRange,
  type AttendanceDaySummary,
  type AttendanceLocationRecord,
} from "../utils/empAttendanceHistory";
import { splitPreviewRecords } from "../utils/empListLimit";
import { EmpRecordHistorySheet } from "../components/emp/EmpRecordHistorySheet";
import { EmpListViewMoreButton } from "../components/emp/EmpListViewMoreButton";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const HISTORY_PREVIEW = 5;

export default function EmpAttendanceMobilePage() {
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(() =>
    getPageCache<TodayStatus>("todayAttendance"),
  );
  const [statusLoading, setStatusLoading] = useState(!todayStatus);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [allDays, setAllDays] = useState<AttendanceDaySummary[]>([]);
  const [searchDate, setSearchDate] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const getToken = () =>
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";

  const loadStatus = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/emp-location-attendance/today?_=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
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
    return allDays;
  }, [allDays, searchDate]);

  const { preview: previewDays, history: historyDays, hasHistory } = splitPreviewRecords(
    listDays,
    HISTORY_PREVIEW,
  );
  const displayDays = searchDate ? listDays : previewDays;

  return (
    <>
      <div className="flex flex-col px-4 pt-4 pb-4">
        <h1 className="text-[20px] font-bold text-gray-900 mb-0.5">Attendance</h1>
        <p className="text-[11px] text-gray-500 mb-3">
          Today&apos;s status · latest {HISTORY_PREVIEW} days below
        </p>

        <div className="shrink-0 mb-4">
          <EmpAttendanceTodayPanel
            todayStatus={todayStatus}
            loading={statusLoading}
            onStatusUpdate={handleStatusUpdate}
            compact={!!searchDate}
          />
        </div>

        <div className="flex flex-col border-t border-gray-200/80 pt-4 mt-1">
          <div className="mb-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">History</p>
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
                Clear · show latest {HISTORY_PREVIEW} days
              </button>
            ) : (
              <p className="text-[10px] text-gray-400 mt-1">Tap a date for full details</p>
            )}
          </div>

          <div className="pb-2">
            {historyLoading ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <Icon icon="solar:refresh-bold-duotone" className="w-7 h-7 text-blue-400 animate-spin" />
                <p className="text-[12px] text-gray-400">Loading…</p>
              </div>
            ) : displayDays.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <Icon icon="solar:calendar-bold-duotone" className="w-9 h-9 text-gray-200" />
                <p className="text-[12px] text-gray-400">No records</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {displayDays.map((day) => (
                    <EmpAttendanceDayRow
                      key={day.dateKey}
                      day={day}
                      compact
                      href={`/empHistory/${encodeDateKey(day.dateKey)}`}
                    />
                  ))}
                </div>
                {!searchDate && hasHistory && (
                  <EmpListViewMoreButton count={historyDays.length} onClick={() => setHistoryOpen(true)} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <EmpRecordHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Attendance history"
        subtitle={`${historyDays.length} older day(s)`}
      >
        <div className="space-y-1.5">
          {historyDays.map((day) => (
            <EmpAttendanceDayRow
              key={day.dateKey}
              day={day}
              compact
              href={`/empHistory/${encodeDateKey(day.dateKey)}`}
            />
          ))}
        </div>
      </EmpRecordHistorySheet>
    </>
  );
}
