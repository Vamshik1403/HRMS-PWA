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
import { gridGap } from "../../../dashboard/components/dashboard-ui";
import { cn } from "../../../utils/cn";
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

  const quickAccessItems = [
    ...quickLinks,
    ...(TASK_MANAGEMENT_ENABLED
      ? [{ key: "tasks", label: "Tasks", href: "/empMyTasks", icon: LayoutDashboard }]
      : []),
  ];

  return (
    <EmpDesktopPage title="Home" description="Your workspace overview" icon={LayoutDashboard}>
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

            <div className="rounded-lg border border-border/60 bg-card px-3 py-2 shadow-sm">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <span className="shrink-0 pr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick access
                </span>
                {quickAccessItems.map((item) => {
                  const badge = badgeFor(item.key);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={item.key === "notice" ? onNoticeClick : undefined}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5",
                        "text-xs font-medium text-foreground hover:border-border hover:bg-muted/50 transition-colors",
                      )}
                    >
                      <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-3.5" />
                      </span>
                      <span>{item.label}</span>
                      {badge > 0 ? (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>

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
      </div>
    </EmpDesktopPage>
  );
}
