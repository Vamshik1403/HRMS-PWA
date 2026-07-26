"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "./data-table";
import { listCardClass } from "./list-ui-styles";
import { cn } from "@/app/utils/cn";

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
  /** Hide the legacy "All X / N total" card header (default true for enterprise layout). */
  hideHeader?: boolean;
  footer?: ReactNode;
  className?: string;
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
  toolbar,
  hideHeader = true,
  footer,
  className,
}: EntityListShellProps<T>) {
  const total = rows?.length ?? 0;
  const description = totalLabel ? totalLabel(total) : `${total} total`;
  const showCount = !isLoading && Array.isArray(rows) && rows.length > 0;

  return (
    <div className={cn("space-y-5", className)}>
      {toolbar}
      <div className={listCardClass}>
        {!hideHeader ? (
          <div className="border-b border-border bg-muted/30 px-6 py-3">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
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
        />
        {footer != null ? (
          footer
        ) : showCount ? (
          <div className="flex flex-col gap-3 border-t border-[#E5E7EB] dark:border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-muted-foreground">
              Showing {total} of {total} {total === 1 ? "record" : "records"}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
