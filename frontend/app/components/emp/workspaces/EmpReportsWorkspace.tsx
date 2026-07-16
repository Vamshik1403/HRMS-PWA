"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Calendar, FileText, MapPin } from "lucide-react";
import { EmpAttendanceDayRow } from "../EmpAttendanceDayRow";
import { EmpMobileDateField } from "../EmpMobileDateField";
import { EmpWorkspaceContent } from "../EmpWorkspaceTabNav";
import { EmpDesktopPage } from "../desktop/EmpDesktopPage";
import { EmpDesktopAttendanceTable } from "../desktop/EmpDesktopAttendanceTable";
import { StatCard, type StatCardData } from "../../../dashboard/components/StatCard";
import { DashboardSection, actionTileClass, gridGap } from "../../../dashboard/components/dashboard-ui";
import { Button } from "../../ui/button";
import {
  encodeDateKey,
  filterDaysByCount,
  filterDaysByRange,
  groupAttendanceByDay,
  type AttendanceDaySummary,
  type AttendanceLocationRecord,
} from "../../../utils/empAttendanceHistory";
import { formatWorkHoursDecimal } from "../../../utils/attendanceDuration";
import { useEffect, useMemo, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const DEFAULT_DAYS = 14;

function ReportsOverview() {
  const tiles = [
    { href: "/empHistory?tab=attendance", icon: MapPin, label: "Attendance reports", desc: "Hours, presence, daily records" },
    { href: "/empAttendance?tab=reports", icon: BarChart3, label: "Attendance analytics", desc: "Summary stats and trends" },
    { href: "/empLeaveApplication?tab=history", icon: Calendar, label: "Leave history", desc: "Past leave applications" },
    { href: "/empPayout?tab=payslips", icon: FileText, label: "Payroll / payslips", desc: "Download payslips by period" },
  ];

  return (
    <div className={`grid sm:grid-cols-2 xl:grid-cols-4 ${gridGap}`}>
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <Link key={t.href} href={t.href} className={actionTileClass}>
            <span className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
              <Icon className="size-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function AttendanceReportsPanel() {
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
          if (r.status === 401) router.replace("/login");
          return Promise.reject(r.status);
        }
        return r.json();
      })
      .then((data: AttendanceLocationRecord[]) => {
        if (Array.isArray(data)) setAllDays(groupAttendanceByDay(data));
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
  const totalHours = formatWorkHoursDecimal(displayDays.reduce((s, d) => s + d.workSeconds, 0));

  const stats: StatCardData[] = [
    { label: "Present days", value: presentDays, icon: Calendar },
    { label: "Total hours", value: totalHours, icon: MapPin, iconClassName: "text-emerald-600" },
    { label: "Records", value: displayDays.length, icon: BarChart3 },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <EmpMobileDateField label="From" value={fromDate} onChange={setFromDate} max={toDate || undefined} />
        <EmpMobileDateField label="To" value={toDate} onChange={setToDate} min={fromDate || undefined} />
      </div>
      {!loading && displayDays.length > 0 ? (
        <div className={`grid sm:grid-cols-3 ${gridGap} mb-6`}>
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>
      ) : null}
      <EmpDesktopAttendanceTable
        days={displayDays}
        loading={loading}
        detailHref={(day) => `/empHistory/${encodeDateKey(day.dateKey)}`}
      />
    </>
  );
}

export function EmpReportsWorkspace() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  if (tab === "attendance") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Attendance reports" description="Filter and export attendance records" icon={MapPin}>
          <AttendanceReportsPanel />
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  if (tab === "leave") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Leave reports" description="Leave application history and balances" icon={Calendar}>
          <DashboardSection className="max-w-lg">
            <Button asChild>
              <Link href="/empLeaveApplication?tab=history">Open leave history</Link>
            </Button>
          </DashboardSection>
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  if (tab === "payroll") {
    return (
      <EmpWorkspaceContent>
        <EmpDesktopPage title="Payroll reports" description="Payslips and salary records" icon={FileText}>
          <DashboardSection className="max-w-lg">
            <Button asChild>
              <Link href="/empPayout?tab=payslips">Open payslips</Link>
            </Button>
          </DashboardSection>
        </EmpDesktopPage>
      </EmpWorkspaceContent>
    );
  }

  return (
    <EmpWorkspaceContent>
      <EmpDesktopPage title="Reports overview" description="Cross-module reports and analytics" icon={BarChart3}>
        <ReportsOverview />
      </EmpDesktopPage>
    </EmpWorkspaceContent>
  );
}
