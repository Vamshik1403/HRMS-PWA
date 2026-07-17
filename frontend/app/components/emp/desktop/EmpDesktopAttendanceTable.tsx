"use client";

import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { EntityListShell } from "../../app/entity-list-shell";
import { DataTable, type DataTableColumn } from "../../app/data-table";
import type { AttendanceDaySummary } from "../../../utils/empAttendanceHistory";
import { useClientTable, sortRows } from "../../../hooks/use-client-table";

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(dateKey: string) {
  const d = new Date(dateKey + "T12:00:00Z");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function statusFor(day: AttendanceDaySummary) {
  if (day.checkIn && day.checkOut) return { label: "Present", variant: "default" as const };
  if (day.checkIn) return { label: "No out", variant: "warning" as const };
  return { label: "Incomplete", variant: "muted" as const };
}

export function EmpDesktopAttendanceTable({
  days,
  loading,
  detailHref,
  title = "Attendance history",
  hideHeader = false,
}: {
  days: AttendanceDaySummary[];
  loading?: boolean;
  detailHref?: (day: AttendanceDaySummary) => string;
  title?: string;
  hideHeader?: boolean;
}) {
  const { sortBy, sortDir, setSort } = useClientTable("dateKey");

  const sorted = sortRows(days, sortBy, sortDir, (d, key) => {
    if (key === "workLabel") return d.workSeconds;
    return d.dateKey;
  });

  if (hideHeader) {
    if (loading) {
      return <p className="py-6 text-center text-sm text-muted-foreground">Loading records…</p>;
    }

    if (sorted.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Records will appear here once you start marking attendance.
        </p>
      );
    }

    return (
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {sorted.map((day) => {
          const href = detailHref?.(day);
          const status = statusFor(day);
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{fmtDate(day.dateKey)}</p>
                <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
                  {fmt(day.checkIn)} – {fmt(day.checkOut)} · {day.workLabel}
                </p>
              </div>
              <Badge variant={status.variant} className="shrink-0 text-[10px]">
                {status.label}
              </Badge>
              {href ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
                  View
                  <ChevronRight className="size-3.5" />
                </span>
              ) : null}
            </>
          );

          return href ? (
            <Link
              key={day.dateKey}
              href={href}
              className="flex min-w-0 items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
            >
              {content}
            </Link>
          ) : (
            <div
              key={day.dateKey}
              className="flex min-w-0 items-center gap-2 px-3 py-2.5 text-sm"
            >
              {content}
            </div>
          );
        })}
      </div>
    );
  }

  const columns: DataTableColumn<AttendanceDaySummary>[] = [
    {
      key: "dateKey",
      header: "Date",
      sortable: true,
      colSpan: 3,
      cell: (day) => <span className="font-medium">{fmtDate(day.dateKey)}</span>,
    },
    {
      key: "in",
      header: "In",
      colSpan: 2,
      cell: (day) => <span className="tabular-nums text-sm">{fmt(day.checkIn)}</span>,
    },
    {
      key: "out",
      header: "Out",
      colSpan: 2,
      cell: (day) => <span className="tabular-nums text-sm">{fmt(day.checkOut)}</span>,
    },
    {
      key: "workLabel",
      header: "Hours",
      sortable: true,
      colSpan: 2,
      cell: (day) => <span className="tabular-nums text-sm">{day.workLabel}</span>,
    },
    {
      key: "status",
      header: "Status",
      colSpan: 2,
      cell: (day) => {
        const s = statusFor(day);
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: "action",
      header: "",
      colSpan: 1,
      align: "right",
      cell: (day) => {
        const href = detailHref?.(day);
        return href ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={href}>View</Link>
          </Button>
        ) : null;
      },
    },
  ];

  return (
    <EntityListShell
      title={title}
      totalLabel={(n) => `${n} record${n === 1 ? "" : "s"}`}
      columns={columns}
      rows={sorted}
      isLoading={!!loading}
      rowKey={(d) => d.dateKey}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={setSort}
      emptyIcon={Calendar}
      emptyTitle="No attendance records"
      emptyDescription="Records will appear here once you start marking attendance."
    />
  );
}
