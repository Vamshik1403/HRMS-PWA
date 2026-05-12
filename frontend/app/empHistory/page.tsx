"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface AttendanceRecord {
  id: number;
  checkType: "CHECK_IN" | "CHECK_OUT";
  checkinTime: string;
  accuracy: number | null;
}

interface DayRow {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  totalHours: string | null;
  accuracy: number | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
function calcHrs(inIso: string, outIso: string): string | null {
  const diff = (new Date(outIso).getTime() - new Date(inIso).getTime()) / 3600000;
  return diff > 0 ? `${diff.toFixed(2)}h` : null;
}
function sumHours(rows: DayRow[]): string {
  let total = 0;
  rows.forEach((r) => {
    if (r.checkIn && r.checkOut) {
      const diff = (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 3600000;
      if (diff > 0) total += diff;
    }
  });
  return total.toFixed(1) + "h";
}

export default function EmpHistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayRows, setDayRows] = useState<DayRow[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    if (!token) return;
    fetch(`${BACKEND}/emp-location-attendance/my`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: AttendanceRecord[]) => {
        if (!Array.isArray(data)) return;
        setRecords(data);
        const byDate: Record<string, AttendanceRecord[]> = {};
        data.forEach((r) => {
          const key = new Date(r.checkinTime).toDateString();
          if (!byDate[key]) byDate[key] = [];
          byDate[key].push(r);
        });
        const rows: DayRow[] = Object.entries(byDate)
          .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
          .map(([, recs]) => {
            const ci = recs.find((r) => r.checkType === "CHECK_IN") || null;
            const co = recs.find((r) => r.checkType === "CHECK_OUT") || null;
            return {
              date: ci?.checkinTime || co?.checkinTime || "",
              checkIn: ci?.checkinTime || null,
              checkOut: co?.checkinTime || null,
              totalHours: ci && co ? calcHrs(ci.checkinTime, co.checkinTime) : null,
              accuracy: ci?.accuracy ?? co?.accuracy ?? null,
            };
          });
        setDayRows(rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const presentDays = dayRows.filter((r) => r.checkIn && r.checkOut).length;
  const totalHours = sumHours(dayRows);

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-6 pb-4">
        {/* Title */}
        <h1 className="text-[22px] font-bold text-gray-900 mb-4">Attendance History</h1>

        {/* Stats */}
        {!loading && dayRows.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[28px] font-bold text-gray-900 leading-none">{presentDays}</p>
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-1">Present Days</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[28px] font-bold text-gray-900 leading-none">{totalHours}</p>
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-1">Total Hours</p>
            </div>
          </div>
        )}

        {/* Records list */}
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-[13px] text-gray-400">Loading history…</p>
          </div>
        ) : dayRows.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Icon icon="solar:calendar-bold-duotone" className="w-10 h-10 text-gray-200" />
            <p className="text-[13px] text-gray-400 font-medium">No attendance records yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayRows.map((day, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-gray-900">{fmtDate(day.date)}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      In {day.checkIn ? fmt(day.checkIn) : "--:--"} · Out {day.checkOut ? fmt(day.checkOut) : "--:--"}
                    </p>
                    {day.accuracy != null && (
                      <p className="text-[11px] text-gray-400 mt-0.5">GPS ±{Math.round(day.accuracy)}m</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {day.totalHours && (
                      <span className="text-[14px] font-bold text-gray-800">{day.totalHours}</span>
                    )}
                    {day.checkIn && day.checkOut ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                        Present
                      </span>
                    ) : day.checkIn ? (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                        No Out
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                        Incomplete
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </EmpMobileLayout>
  );
}
