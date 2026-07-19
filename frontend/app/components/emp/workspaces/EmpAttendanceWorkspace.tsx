"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";
import { EmpDesktopPage } from "../desktop/EmpDesktopPage";
import { EmpDesktopAttendancePanel } from "../desktop/EmpDesktopAttendancePanel";
import { EmpDesktopAttendanceTable } from "../desktop/EmpDesktopAttendanceTable";
import { EmpDateField } from "../EmpDateField";
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
import { AttendanceTrendChart } from "../../../dashboard/components/AttendanceTrendChart";
import SoftBarChart from "../../../dashboard/components/SoftBarChart";
import { attendanceDaysToHoursChart } from "../desktop/EmpSegmentDonut";
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

  const weekChartData = useMemo(() => attendanceDaysToHoursChart(weekDays), [weekDays]);
  const reportChartData = useMemo(() => attendanceDaysToHoursChart(reportDays), [reportDays]);

  const weekPresenceTrend = useMemo(
    () => [...weekDays].reverse().map((d) => (d.checkIn ? 1 : 0)),
    [weekDays],
  );
  const weekHoursTrend = useMemo(
    () => [...weekDays].reverse().map((d) => Math.round((d.workSeconds / 3600) * 10) / 10),
    [weekDays],
  );

  const detailHref = (day: AttendanceDaySummary) => `/empHistory/${encodeDateKey(day.dateKey)}`;

  const overviewStats: StatCardData[] = [
    {
      label: "Days present (week)",
      value: presentThisWeek,
      unit: `of ${weekDays.length} days tracked`,
      icon: Calendar,
      visualization: { type: "sparkline", data: weekPresenceTrend, color: "#2563eb" },
    },
    {
      label: "Hours worked (week)",
      value: weekHours,
      unit: "Total logged hours",
      icon: Clock,
      iconClassName: "bg-emerald-500/10 text-emerald-600",
      visualization: { type: "sparkline", data: weekHoursTrend, color: "#22c55e" },
    },
    {
      label: "Monthly attendance",
      value: `${monthPct}%`,
      unit: `${presentMonth} full days this month`,
      icon: MapPin,
      visualization: { type: "ring", value: monthPct, max: 100, color: "#7c3aed" },
    },
    {
      label: "Break today",
      value: todayStatus?.breakMinutes != null ? `${todayStatus.breakMinutes}m` : "0m",
      unit: "Break time logged",
      icon: Clock,
      iconClassName: "bg-amber-500/10 text-amber-600",
      visualization: {
        type: "progress",
        segments: [
          { label: "Break", value: todayStatus?.breakMinutes ?? 0, color: "#f59e0b" },
          { label: "Work", value: Math.round((todayStatus?.workSeconds ?? 0) / 60), color: "#22c55e" },
        ],
      },
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
        <div className="min-w-0 lg:col-span-2 space-y-6">
          <DashboardSection>
            <h2 className="text-lg font-semibold tracking-tight">Hours this week</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Daily work hours from your punch records</p>
            <SoftBarChart data={weekChartData} highlightColor="#2563eb" barColor="#dbeafe" />
          </DashboardSection>
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
            <EmpDateField
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
    const reportHoursTrend = reportDays
      .slice()
      .reverse()
      .slice(-7)
      .map((d) => Math.round((d.workSeconds / 3600) * 10) / 10);
    const reportStats: StatCardData[] = [
      {
        label: "Present days",
        value: present,
        unit: `of ${reportDays.length} records`,
        icon: Calendar,
        visualization: {
          type: "bars",
          items: reportDays
            .slice(0, 5)
            .map((d) => ({
              label: new Date(d.dateKey + "T12:00:00Z").toLocaleDateString("en-IN", {
                weekday: "short",
                timeZone: "UTC",
              }),
              value: d.checkIn && d.checkOut ? 1 : 0,
            })),
        },
      },
      {
        label: "Total hours",
        value: hours,
        unit: "In selected period",
        icon: Clock,
        iconClassName: "bg-emerald-500/10 text-emerald-600",
        visualization: { type: "sparkline", data: reportHoursTrend, color: "#22c55e" },
      },
      {
        label: "Records",
        value: reportDays.length,
        unit: "Attendance entries",
        icon: MapPin,
        visualization: {
          type: "stacked",
          segments: [
            { label: "Complete", value: present, color: "#22c55e" },
            {
              label: "Partial",
              value: reportDays.filter((d) => d.checkIn && !d.checkOut).length,
              color: "#f59e0b",
            },
            {
              label: "Absent",
              value: reportDays.filter((d) => !d.checkIn).length,
              color: "#f43f5e",
            },
          ],
        },
      },
    ];

    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage
          title={tab === "reports" ? "Attendance reports" : "Attendance calendar"}
          description="Filter by date range and review records"
          icon={Calendar}
        >
          <div className="flex flex-wrap items-end gap-3">
            <EmpDateField label="From" value={fromDate} onChange={setFromDate} max={toDate || undefined} />
            <EmpDateField label="To" value={toDate} onChange={setToDate} min={fromDate || undefined} />
          </div>
          {tab === "reports" ? (
            <>
              <div className={`grid sm:grid-cols-3 ${gridGap} mb-6`}>
                {reportStats.map((s) => (
                  <StatCard key={s.label} stat={s} />
                ))}
              </div>
              <DashboardSection className="mb-6">
                <h2 className="text-lg font-semibold tracking-tight">Attendance trend</h2>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Work hours across the selected period</p>
                <AttendanceTrendChart data={reportChartData} />
              </DashboardSection>
            </>
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
