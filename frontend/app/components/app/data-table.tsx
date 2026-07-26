"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, type LucideIcon } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { EmptyState } from "./empty-state";
import { cn } from "@/app/utils/cn";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  colSpan?: number;
  sortable?: boolean;
  align?: "left" | "right";
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[] | undefined;
  isLoading?: boolean;
  rowKey: (row: T) => string;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  sortBy?: string | null;
  sortDir?: "asc" | "desc";
  onSort?: (field: string) => void;
}

function sortIndicator(isSorted: boolean, sortDir: "asc" | "desc" | undefined) {
  if (!isSorted) return ArrowUpDown;
  return sortDir === "asc" ? ArrowUp : ArrowDown;
}

const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5"];

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  rowKey,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  sortBy,
  sortDir,
  onSort,
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="h-[52px] border-b border-[#E5E7EB] bg-[#FAFBFC] dark:border-border dark:bg-muted/40">
              {columns.map((c) => {
                const isSorted = sortBy === c.key;
                const Indicator = sortIndicator(isSorted, sortDir);
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "px-6 text-[13px] font-semibold tracking-wide text-muted-foreground",
                      c.align === "right" && "text-right",
                      c.sortable && "cursor-pointer select-none hover:text-foreground",
                    )}
                    onClick={() => c.sortable && onSort?.(c.key)}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        c.align === "right" && "w-full justify-end",
                      )}
                    >
                      {c.header}
                      {c.sortable ? (
                        <Indicator
                          className={cn("size-3.5", isSorted ? "text-primary" : "opacity-40")}
                        />
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              SKELETON_KEYS.map((k) => (
                <tr key={k} className="h-16 border-b border-[#E5E7EB]/80 dark:border-border">
                  {columns.map((c) => (
                    <td key={`${k}-${c.key}`} className="px-6 py-3">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState
                    icon={emptyIcon ?? ArrowUpDown}
                    title={emptyTitle ?? "No records found"}
                    description={
                      emptyDescription ?? "Try changing your search or filters."
                    }
                    /* Page header already has the primary Add action — do not duplicate it here. */
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="h-16 border-b border-[#E5E7EB]/80 transition-colors last:border-0 hover:bg-[#F8FAFC] dark:border-border dark:hover:bg-muted/40"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "min-w-0 px-6 py-3 align-middle text-[15px] font-medium text-foreground",
                        c.align === "right" && "text-right",
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
