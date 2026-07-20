"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { EntityListShell } from "../../app/entity-list-shell";
import type { DataTableColumn } from "../../app/data-table";
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
      <div className="flex flex-wrap items-stretch gap-2">
        {items.map((c) => (
          <div
            key={c.key}
            className="flex-1 min-w-[100px] rounded-lg border border-border bg-card px-3 py-2 shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="text-lg font-bold tabular-nums text-foreground mt-0.5">
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

export function EmpDesktopLeaveTable({
  apps,
  loading,
  isManagerView,
  employeeNameForRow,
  onApprove,
  onDelete,
  title = "Leave requests",
}: {
  apps: LeaveAppRow[];
  loading?: boolean;
  isManagerView: boolean;
  employeeNameForRow: (app: LeaveAppRow) => string;
  onApprove: (app: LeaveAppRow) => void;
  onDelete: (id: string) => void;
  title?: string;
}) {
  const { sortBy, sortDir, setSort } = useClientTable("createdAt");

  const sorted = sortRows(apps, sortBy, sortDir, (a, key) => {
    if (key === "fromDate") return a.fromDate;
    return a.createdAt;
  });

  const columns: DataTableColumn<LeaveAppRow>[] = [
    {
      key: "employee",
      header: "Employee",
      colSpan: 2,
      cell: (app) => (
        <span className="text-sm font-medium">
          {isManagerView ? employeeNameForRow(app) : "You"}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      colSpan: 2,
      cell: (app) => <span className="text-sm">{getDisplayLeaveType(app)}</span>,
    },
    {
      key: "dates",
      header: "Applied dates",
      colSpan: 3,
      cell: (app) => (
        <span className="text-sm text-muted-foreground">{getAppliedDateRange(app)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      colSpan: 2,
      sortable: true,
      cell: (app) => {
        const label = getDisplayLeaveStatus(app.status, app.dayStatuses);
        return <Badge variant={statusVariant(label)}>{label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      colSpan: 3,
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

  return (
    <EntityListShell
      title={title}
      totalLabel={(n) => `${n} request${n === 1 ? "" : "s"}`}
      columns={columns}
      rows={sorted}
      isLoading={!!loading}
      rowKey={(a) => a.id}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={setSort}
      emptyIcon={Calendar}
      emptyTitle="No leave requests"
      emptyDescription="Apply for leave to see your requests here."
    />
  );
}
