"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "./data-table";

interface EntityListShellProps<T> {
  title: string;
  totalLabel?: (total: number) => string;
  columns: Array<DataTableColumn<T>>;
  rows: T[] | undefined;
  isLoading: boolean;
  rowKey: (row: T) => string;
  sortBy: string | null;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  toolbar?: ReactNode;
  hideHeader?: boolean;
}

export function EntityListShell<T>({
  title,
  totalLabel,
  columns,
  rows,
  isLoading,
  rowKey,
  sortBy,
  sortDir,
  onSort,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  toolbar,
  hideHeader = false,
}: EntityListShellProps<T>) {
  const total = rows?.length ?? 0;
  const description = totalLabel ? totalLabel(total) : `${total} total`;

  return (
    <div className="space-y-4">
      {toolbar}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {!hideHeader ? (
          <div className="border-b border-border px-4 py-3 bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        ) : null}
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          isLoading={!!isLoading}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          emptyIcon={emptyIcon}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyAction={emptyAction}
        />
      </div>
    </div>
  );
}
