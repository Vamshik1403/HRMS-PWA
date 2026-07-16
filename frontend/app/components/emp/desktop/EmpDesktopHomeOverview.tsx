"use client";

import { useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  FileText,
  LayoutDashboard,
  MapPin,
  Wallet,
} from "lucide-react";
import { DashboardSection, actionTileClass, gridGap } from "../../../dashboard/components/dashboard-ui";
import { EmpDesktopHomeProfileHero } from "./EmpDesktopHomeProfileHero";
import { EmpDesktopAttendancePanel } from "./EmpDesktopAttendancePanel";
import { EmpDesktopTeamReportees } from "./EmpDesktopTeamReportees";
import { EmpDesktopNotifications } from "./EmpDesktopNotifications";
import { EmpDesktopPage } from "./EmpDesktopPage";
import type { TodayStatus } from "../../../hooks/useEmpPunch";
import { TASK_MANAGEMENT_ENABLED } from "../../../config/featureFlags";
import { useEmpManagerScope } from "../../../hooks/useEmpManagerScope";

const quickLinks = [
  { key: "attendance", label: "Attendance", href: "/empAttendance", icon: MapPin },
  { key: "leave", label: "Leave", href: "/empLeaveApplication", icon: Calendar },
  { key: "payroll", label: "Payroll", href: "/empPayout", icon: FileText },
  { key: "reimb", label: "Reimbursement", href: "/empReimbursement", icon: Wallet },
  { key: "notice", label: "Messages", href: "/empNoticeboard", icon: Bell },
];

export function EmpDesktopHomeOverview({
  empFullName,
  empPhoto,
  empInitials,
  designation,
  department,
  todayStatus,
  loadingStatus,
  onStatusUpdate,
  taskBadge,
  noticeBadge,
  reimbBadge,
  leaveBadge,
  onNoticeClick,
}: {
  empFullName: string;
  empPhoto: string | null;
  empInitials: string;
  designation?: string | null;
  department?: string | null;
  todayStatus: TodayStatus | null;
  loadingStatus: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
  taskBadge: number;
  noticeBadge: number;
  reimbBadge: number;
  leaveBadge: number;
  onNoticeClick?: () => void;
}) {
  const { isManagerView } = useEmpManagerScope();

  const badgeFor = useCallback(
    (key: string) => {
      if (key === "tasks") return taskBadge;
      if (key === "notice") return noticeBadge;
      if (key === "reimb") return reimbBadge;
      if (key === "leave") return leaveBadge;
      return 0;
    },
    [taskBadge, noticeBadge, reimbBadge, leaveBadge],
  );

  return (
    <EmpDesktopPage>
      <div className="space-y-6">
        <div className={`grid lg:grid-cols-3 ${gridGap} items-stretch`}>
          <div className="lg:col-span-2 space-y-6">
            <EmpDesktopHomeProfileHero
              empFullName={empFullName}
              empPhoto={empPhoto}
              empInitials={empInitials}
              designation={designation}
              department={department}
              todayStatus={todayStatus}
              loadingStatus={loadingStatus}
              onStatusUpdate={onStatusUpdate}
            />

            <EmpDesktopAttendancePanel
              todayStatus={todayStatus}
              loading={loadingStatus}
              onStatusUpdate={onStatusUpdate}
              compact
              showActions={false}
            />
          </div>

          <div className="min-w-0 lg:col-span-1 flex">
            {isManagerView ? <EmpDesktopTeamReportees /> : <EmpDesktopNotifications />}
          </div>
        </div>

        <DashboardSection>
          <h2 className="text-xl font-semibold tracking-tight">Quick access</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Jump to your most-used modules</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {quickLinks.map((item) => {
              const badge = badgeFor(item.key);
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={actionTileClass}
                  onClick={item.key === "notice" ? onNoticeClick : undefined}
                >
                  <span className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">{item.label}</span>
                    {badge > 0 ? (
                      <span className="text-xs text-muted-foreground">{badge} pending</span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
            {TASK_MANAGEMENT_ENABLED ? (
              <Link href="/empMyTasks" className={actionTileClass}>
                <span className="size-10 rounded-md bg-violet-500/10 text-violet-600 grid place-items-center shrink-0">
                  <LayoutDashboard className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">Tasks</span>
                  {taskBadge > 0 ? (
                    <span className="text-xs text-muted-foreground">{taskBadge} active</span>
                  ) : null}
                </span>
              </Link>
            ) : null}
          </div>
        </DashboardSection>
      </div>
    </EmpDesktopPage>
  );
}
