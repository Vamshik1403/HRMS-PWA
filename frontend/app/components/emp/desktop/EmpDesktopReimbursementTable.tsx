"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { EntityListShell } from "../../app/entity-list-shell";
import type { DataTableColumn } from "../../app/data-table";
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

export function EmpDesktopReimbursementTable({
  rows,
  loading,
  isManagerView,
  employeeNameForRow,
  onApprove,
  onDelete,
  title = "Reimbursement claims",
}: {
  rows: ReimbursementRow[];
  loading?: boolean;
  isManagerView: boolean;
  employeeNameForRow: (row: ReimbursementRow) => string;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  title?: string;
}) {
  const { sortBy, sortDir, setSort } = useClientTable("date");

  const sorted = sortRows(rows, sortBy, sortDir, (r, key) => {
    if (key === "amount") return totalAmount(r);
    return r.date || "";
  });

  const columns: DataTableColumn<ReimbursementRow>[] = [
    {
      key: "employee",
      header: "Employee",
      colSpan: 2,
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
      colSpan: 2,
      cell: (r) => <span className="text-sm tabular-nums">{r.date || "—"}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      colSpan: 2,
      cell: (r) => (
        <span className="text-sm font-medium tabular-nums">₹{totalAmount(r).toFixed(2)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      colSpan: 2,
      cell: (r) => {
        const label = displayStatus(r.status);
        return <Badge variant={statusVariant(label)}>{label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      colSpan: 4,
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

  return (
    <EntityListShell
      title={title}
      totalLabel={(n) => `${n} claim${n === 1 ? "" : "s"}`}
      columns={columns}
      rows={sorted}
      isLoading={!!loading}
      rowKey={(r) => r.id}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={setSort}
      emptyIcon={Wallet}
      emptyTitle="No reimbursement claims"
      emptyDescription="Submit a claim to track it here."
    />
  );
}
