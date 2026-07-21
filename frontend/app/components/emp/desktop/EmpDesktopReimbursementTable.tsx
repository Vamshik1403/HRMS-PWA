"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { DataTable, type DataTableColumn } from "../../app/data-table";
import { useClientTable, sortRows } from "../../../hooks/use-client-table";
import { displayStatusLabel } from "../../../utils/statusDisplay";
import type { ReimbursementRow } from "../EmpReimbursementMobile";
import { totalAmount } from "../EmpReimbursementMobile";

function statusVariant(label: string): "default" | "destructive" | "warning" | "secondary" | "muted" {
  if (label === "Approved" || label === "Paid") return "default";
  if (label === "Rejected") return "destructive";
  if (label === "Partially Approved") return "warning";
  if (label === "Pending" || label === "Pending for Approval") return "secondary";
  return "muted";
}

function displayStatus(s: string) {
  const label = displayStatusLabel(s);
  const map: Record<string, string> = {
    Pending: "Pending for Approval",
    Approved: "Approved",
    Rejected: "Rejected",
    "Partially Approved": "Partially Approved",
    Paid: "Paid",
  };
  return map[label] || label;
}

function buildReimbursementColumns(
  isManagerView: boolean,
  employeeNameForRow: (row: ReimbursementRow) => string,
  onApprove: (id: string) => void,
  onDelete: (id: string) => void,
): DataTableColumn<ReimbursementRow>[] {
  return [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => (
        <span className="text-sm font-medium">
          {isManagerView ? employeeNameForRow(r) : "You"}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      cell: (r) => <span className="text-sm tabular-nums">{r.date || "—"}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      cell: (r) => (
        <span className="text-sm font-medium tabular-nums">₹{totalAmount(r).toFixed(2)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => {
        const label = displayStatus(r.status);
        return <Badge variant={statusVariant(label)}>{label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) => {
        const label = displayStatusLabel(r.status);
        return (
          <div className="flex justify-end gap-1 flex-wrap">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/empReimbursement/${r.id}`}>View</Link>
            </Button>
            {isManagerView && (label === "Pending" || label === "Partially Approved") ? (
              <Button variant="outline" size="sm" onClick={() => onApprove(r.id)}>
                Review
              </Button>
            ) : null}
            {!isManagerView && label === "Pending" ? (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(r.id)}>
                Delete
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

export function EmpDesktopReimbursementGrid({
  rows,
  isManagerView,
  employeeNameForRow,
}: {
  rows: ReimbursementRow[];
  isManagerView: boolean;
  employeeNameForRow: (row: ReimbursementRow) => string;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((r) => {
        const label = displayStatus(r.status);
        return (
          <div
            key={r.id}
            className="rounded-xl border border-border bg-card shadow-sm p-4 hover:border-primary/40 transition-colors"
          >
            <p className="text-xs text-muted-foreground">
              {isManagerView ? employeeNameForRow(r) : "You"}
            </p>
            <p className="font-semibold text-foreground mt-1 tabular-nums">₹{totalAmount(r).toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1">{r.date || "—"}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Badge variant={statusVariant(label)}>{label}</Badge>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/empReimbursement/${r.id}`}>View</Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EmpDesktopReimbursementTable({
  rows,
  loading,
  isManagerView,
  employeeNameForRow,
  onApprove,
  onDelete,
  hideHeader = false,
}: {
  rows: ReimbursementRow[];
  loading?: boolean;
  isManagerView: boolean;
  employeeNameForRow: (row: ReimbursementRow) => string;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  hideHeader?: boolean;
}) {
  const { sortBy, sortDir, setSort } = useClientTable("date");

  const sorted = sortRows(rows, sortBy, sortDir, (r, key) => {
    if (key === "amount") return totalAmount(r);
    return r.date || "";
  });

  const columns = buildReimbursementColumns(isManagerView, employeeNameForRow, onApprove, onDelete);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <DataTable
        columns={columns}
        rows={sorted}
        rowKey={(r) => r.id}
        isLoading={!!loading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={setSort}
        emptyIcon={Wallet}
        emptyTitle="No reimbursement claims"
        emptyDescription="Submit a claim to track it here."
      />
    </div>
  );
}
