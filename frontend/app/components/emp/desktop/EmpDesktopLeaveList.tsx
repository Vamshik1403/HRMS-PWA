"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { DataTable, type DataTableColumn } from "../../app/data-table";
import { StatCard, type StatCardData } from "../../../dashboard/components/StatCard";
import { gridGap } from "../../../dashboard/components/dashboard-ui";
import { useClientTable, sortRows } from "../../../hooks/use-client-table";
import {
  getAppliedDateRange,
  getApprovedDateRange,
  getDisplayLeaveStatus,
  getDisplayLeaveType,
  formatDateShort,
} from "../../../utils/leaveDisplay";
import type { LeaveAppRow } from "../EmpLeaveMobile";
import { cn } from "@/app/utils/cn";

function statusVariant(label: string): "default" | "destructive" | "warning" | "secondary" | "muted" {
  if (label === "Approved") return "default";
  if (label === "Rejected") return "destructive";
  if (label === "Partially Approved") return "warning";
  if (label === "Approval Pending") return "secondary";
  return "muted";
}

export function EmpDesktopLeaveBalance({
  cards,
  loading,
  compact = false,
}: {
  cards: { key: string; label: string; remaining: number; total: number }[];
  loading: boolean;
  compact?: boolean;
}) {
  if (compact) {
    const items = cards.length
      ? cards
      : [
          { key: "sick", label: "Sick", remaining: 0, total: 0 },
          { key: "casual", label: "Casual", remaining: 0, total: 0 },
          { key: "privileged", label: "Privilege", remaining: 0, total: 0 },
        ];
    return (
      <div className="flex items-stretch gap-1.5 shrink-0">
        {items.map((c) => (
          <div
            key={c.key}
            className="w-[72px] rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm"
          >
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{c.label}</p>
            <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">
              {loading ? "…" : `${c.remaining}/${c.total}`}
            </p>
          </div>
        ))}
      </div>
    );
  }

  const stats: StatCardData[] = (cards.length ? cards : [
    { key: "sick", label: "Sick", remaining: 0, total: 0 },
    { key: "casual", label: "Casual", remaining: 0, total: 0 },
    { key: "privileged", label: "Privilege", remaining: 0, total: 0 },
  ]).map((c) => ({
    label: c.label,
    value: loading ? "…" : `${c.remaining}/${c.total}`,
    icon: Calendar,
    unit: "Remaining / total days",
    visualization: loading
      ? undefined
      : {
          type: "ring" as const,
          value: c.total > 0 ? Math.round((c.remaining / c.total) * 100) : 0,
          max: 100,
          color: c.key === "sick" ? "#f43f5e" : c.key === "casual" ? "#2563eb" : "#7c3aed",
        },
  }));

  return (
    <div className={`grid sm:grid-cols-3 ${gridGap}`}>
      {stats.map((s) => (
        <StatCard key={s.label} stat={s} />
      ))}
    </div>
  );
}

function buildLeaveColumns(
  isManagerView: boolean,
  employeeNameForRow: (app: LeaveAppRow) => string,
  onApprove: (app: LeaveAppRow) => void,
  onDelete: (id: string) => void,
): DataTableColumn<LeaveAppRow>[] {
  return [
    {
      key: "employee",
      header: "Employee",
      cell: (app) => (
        <span className="text-sm font-medium">
          {isManagerView ? employeeNameForRow(app) : "You"}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (app) => <span className="text-sm">{getDisplayLeaveType(app)}</span>,
    },
    {
      key: "dates",
      header: "Applied dates",
      cell: (app) => (
        <span className="text-sm text-muted-foreground">{getAppliedDateRange(app)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (app) => {
        const label = getDisplayLeaveStatus(app.status, app.dayStatuses);
        return <Badge variant={statusVariant(label)}>{label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (app) => {
        const label = getDisplayLeaveStatus(app.status, app.dayStatuses);
        return (
          <div className="flex justify-end gap-1 flex-wrap">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/empLeaveApplication/${app.id}`}>View</Link>
            </Button>
            {isManagerView && label === "Approval Pending" ? (
              <Button variant="outline" size="sm" onClick={() => onApprove(app)}>
                Review
              </Button>
            ) : null}
            {!isManagerView && label === "Approval Pending" ? (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(app.id)}>
                Delete
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

export function EmpDesktopLeaveGrid({
  apps,
  isManagerView,
  employeeNameForRow,
}: {
  apps: LeaveAppRow[];
  isManagerView: boolean;
  employeeNameForRow: (app: LeaveAppRow) => string;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {apps.map((app) => {
        const label = getDisplayLeaveStatus(app.status, app.dayStatuses);
        return (
          <div
            key={app.id}
            className="rounded-xl border border-border bg-card shadow-sm p-4 hover:border-primary/40 transition-colors"
          >
            <p className="text-xs text-muted-foreground">
              {isManagerView ? employeeNameForRow(app) : "You"}
            </p>
            <p className="font-semibold text-foreground mt-1">{getDisplayLeaveType(app)}</p>
            <p className="text-sm text-muted-foreground mt-1">{getAppliedDateRange(app)}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Badge variant={statusVariant(label)}>{label}</Badge>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/empLeaveApplication/${app.id}`}>View</Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EmpDesktopLeaveTable({
  apps,
  loading,
  isManagerView,
  employeeNameForRow,
  onApprove,
  onDelete,
  hideHeader = false,
}: {
  apps: LeaveAppRow[];
  loading?: boolean;
  isManagerView: boolean;
  employeeNameForRow: (app: LeaveAppRow) => string;
  onApprove: (app: LeaveAppRow) => void;
  onDelete: (id: string) => void;
  hideHeader?: boolean;
}) {
  const { sortBy, sortDir, setSort } = useClientTable("createdAt");

  const sorted = sortRows(apps, sortBy, sortDir, (a, key) => {
    if (key === "fromDate") return a.fromDate;
    return a.createdAt;
  });

  const columns = buildLeaveColumns(isManagerView, employeeNameForRow, onApprove, onDelete);

  if (hideHeader) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <DataTable
          columns={columns}
          rows={sorted}
          rowKey={(a) => a.id}
          isLoading={!!loading}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={setSort}
          emptyIcon={Calendar}
          emptyTitle="No leave requests"
          emptyDescription="Apply for leave to see your requests here."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <DataTable
        columns={columns}
        rows={sorted}
        rowKey={(a) => a.id}
        isLoading={!!loading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={setSort}
        emptyIcon={Calendar}
        emptyTitle="No leave requests"
        emptyDescription="Apply for leave to see your requests here."
      />
    </div>
  );
}
