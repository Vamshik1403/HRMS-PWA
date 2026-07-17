"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";
import { EmpDesktopPage } from "../desktop/EmpDesktopPage";
import { EmpDesktopAttendancePanel } from "../desktop/EmpDesktopAttendancePanel";
import { EmpDesktopAttendanceTable } from "../desktop/EmpDesktopAttendanceTable";
import { EmpMobileDateField } from "../EmpMobileDateField";
import { EmpRecordHistorySheet } from "../EmpRecordHistorySheet";
import { EmpListViewMoreButton } from "../EmpListViewMoreButton";
import { StatCard, type StatCardData } from "../../../dashboard/components/StatCard";
import { DashboardSection, gridGap } from "../../../dashboard/components/dashboard-ui";
import type { TodayStatus } from "../../../hooks/useEmpPunch";
import { getPageCache, setPageCache } from "../../../utils/pageCache";
import {
  encodeDateKey,
  filterDaysByCount,
  filterDaysByRange,
  groupAttendanceByDay,
  lastNDaysRange,
  type AttendanceDaySummary,
  type AttendanceLocationRecord,
} from "../../../utils/empAttendanceHistory";
import { formatWorkHoursDecimal } from "../../../utils/attendanceDuration";
import { splitPreviewRecords } from "../../../utils/empListLimit";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export function EmpAttendanceWorkspace({ embedded = false }: { embedded?: boolean } = {}) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(() =>
    getPageCache<TodayStatus>("todayAttendance"),
  );
  const [statusLoading, setStatusLoading] = useState(!todayStatus);
  const [allDays, setAllDays] = useState<AttendanceDaySummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [searchDate, setSearchDate] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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

  const loadHistory = useCallback(async (from?: string, to?: string) => {
    const token = getToken();
    if (!token) return;
    setHistoryLoading(true);
    const range = from && to ? { from, to } : lastNDaysRange(30);
    try {
      const res = await fetch(
        `${BACKEND}/emp-location-attendance/my?from=${range.from}&to=${range.to}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
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
    const id = setInterval(() => loadStatus(), 30_000);
    return () => clearInterval(id);
  }, [loadStatus, loadHistory]);

  useEffect(() => {
    if (tab === "reports" || tab === "calendar") {
      loadHistory(fromDate || undefined, toDate || undefined);
    }
  }, [fromDate, toDate, tab, loadHistory]);

  const handleStatusUpdate = useCallback(
    (status: TodayStatus) => {
      setTodayStatus(status);
      setPageCache("todayAttendance", status);
      loadHistory();
    },
    [loadHistory],
  );

  const weekDays = useMemo(() => filterDaysByCount(allDays, 7), [allDays]);
  const presentThisWeek = weekDays.filter((d) => d.checkIn).length;
  const weekHours = formatWorkHoursDecimal(weekDays.reduce((s, d) => s + d.workSeconds, 0));
  const monthDays = useMemo(() => filterDaysByCount(allDays, 30), [allDays]);
  const presentMonth = monthDays.filter((d) => d.checkIn && d.checkOut).length;
  const monthPct = monthDays.length ? Math.round((presentMonth / monthDays.length) * 100) : 0;

  const listDays = useMemo(() => {
    if (searchDate) return filterDaysByRange(allDays, searchDate, searchDate);
    return allDays;
  }, [allDays, searchDate]);

  const { preview: previewDays, history: historyDays, hasHistory } = splitPreviewRecords(listDays, 12);
  const displayDays = searchDate ? listDays : previewDays;

  const reportDays = useMemo(() => {
    const ranged = filterDaysByRange(allDays, fromDate, toDate);
    if (fromDate || toDate) return ranged;
    return filterDaysByCount(ranged, 14);
  }, [allDays, fromDate, toDate]);

  const detailHref = (day: AttendanceDaySummary) => `/empHistory/${encodeDateKey(day.dateKey)}`;

  const overviewStats: StatCardData[] = [
    { label: "Days present (week)", value: presentThisWeek, icon: Calendar },
    { label: "Hours worked (week)", value: weekHours, icon: Clock, iconClassName: "text-emerald-600" },
    { label: "Monthly attendance", value: `${monthPct}%`, icon: MapPin },
    {
      label: "Break today",
      value: todayStatus?.breakMinutes != null ? `${todayStatus.breakMinutes}m` : "0m",
      icon: Clock,
      iconClassName: "text-amber-600",
    },
  ];

  const overviewContent = (
    <>
      <div className={`grid sm:grid-cols-2 xl:grid-cols-4 ${gridGap}`}>
        {overviewStats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      <div className={`grid lg:grid-cols-3 ${gridGap} items-start`}>
        <div className="min-w-0 lg:col-span-2">
          <EmpDesktopAttendancePanel
            todayStatus={todayStatus}
            loading={statusLoading}
            onStatusUpdate={handleStatusUpdate}
            compact
          />
        </div>
        <DashboardSection className="min-w-0 lg:col-span-1">
          <h2 className="text-xl font-semibold tracking-tight">Recent activity</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Latest attendance records</p>
          <EmpDesktopAttendanceTable
            days={previewDays.slice(0, 5)}
            loading={historyLoading}
            detailHref={detailHref}
            hideHeader
          />
          <Link href="/empAttendance?tab=history" className="inline-block mt-4 text-sm font-medium text-primary hover:underline">
            View full history →
          </Link>
        </DashboardSection>
      </div>
    </>
  );

  if (embedded) {
    return overviewContent;
  }

  if (tab === "check-in") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Check in / out" description="Mark attendance for today" icon={MapPin}>
          <EmpDesktopAttendancePanel
            todayStatus={todayStatus}
            loading={statusLoading}
            onStatusUpdate={handleStatusUpdate}
          />
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  if (tab === "history") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Attendance history" description="Search and review past attendance" icon={Calendar}>
          <div className="flex flex-wrap items-end gap-3 mb-2">
            <EmpMobileDateField
              label="Search by date"
              value={searchDate}
              onChange={setSearchDate}
              max={new Date().toISOString().slice(0, 10)}
            />
            {searchDate ? (
              <button type="button" onClick={() => setSearchDate("")} className="text-sm font-medium text-primary">
                Clear filter
              </button>
            ) : null}
          </div>
          <EmpDesktopAttendanceTable
            days={displayDays}
            loading={historyLoading}
            detailHref={detailHref}
          />
          {!searchDate && hasHistory ? (
            <EmpListViewMoreButton count={historyDays.length} onClick={() => setHistoryOpen(true)} />
          ) : null}
          <EmpRecordHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Older attendance" subtitle={`${historyDays.length} record(s)`}>
            <EmpDesktopAttendanceTable days={historyDays} detailHref={detailHref} />
          </EmpRecordHistorySheet>
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  if (tab === "calendar" || tab === "reports") {
    const present = reportDays.filter((d) => d.checkIn && d.checkOut).length;
    const hours = formatWorkHoursDecimal(reportDays.reduce((s, d) => s + d.workSeconds, 0));
    const reportStats: StatCardData[] = [
      { label: "Present days", value: present, icon: Calendar },
      { label: "Total hours", value: hours, icon: Clock, iconClassName: "text-emerald-600" },
      { label: "Records", value: reportDays.length, icon: MapPin },
    ];

    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage
          title={tab === "reports" ? "Attendance reports" : "Attendance calendar"}
          description="Filter by date range and review records"
          icon={Calendar}
        >
          <div className="flex flex-wrap items-end gap-3">
            <EmpMobileDateField label="From" value={fromDate} onChange={setFromDate} max={toDate || undefined} />
            <EmpMobileDateField label="To" value={toDate} onChange={setToDate} min={fromDate || undefined} />
          </div>
          {tab === "reports" ? (
            <div className={`grid sm:grid-cols-3 ${gridGap} mb-6`}>
              {reportStats.map((s) => (
                <StatCard key={s.label} stat={s} />
              ))}
            </div>
          ) : null}
          <EmpDesktopAttendanceTable days={reportDays} loading={historyLoading} detailHref={detailHref} />
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  return (
    <EmpWorkspaceContent>
      <EmpDesktopPage title="Attendance overview" description="Today's status, weekly summary, and recent activity" icon={MapPin}>
        {overviewContent}
      </EmpDesktopPage>
    </EmpWorkspaceContent>
  );
}
