"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, type LucideIcon } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { EmptyState } from "./empty-state";

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

const GRID_COLS = 12;

const COL_SPAN: Record<number, string> = {
  1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4",
  5: "col-span-5", 6: "col-span-6", 7: "col-span-7", 8: "col-span-8",
  9: "col-span-9", 10: "col-span-10", 11: "col-span-11", 12: "col-span-12",
};

const colClass = (span: number) => COL_SPAN[Math.max(1, Math.min(12, span))] ?? "col-span-2";

/** Ensure column spans always sum to 12 so grid rows never wrap. */
function resolveColSpans(columns: Array<{ colSpan?: number }>): number[] {
  const n = columns.length;
  if (n === 0) return [];

  const hasExplicit = columns.some((c) => c.colSpan != null && c.colSpan > 0);
  if (!hasExplicit) {
    const base = Math.floor(GRID_COLS / n);
    const extra = GRID_COLS % n;
    return columns.map((_, i) => base + (i < extra ? 1 : 0));
  }

  const weights = columns.map((c) => Math.max(1, c.colSpan ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === GRID_COLS) return weights;

  const exact = weights.map((w) => (w / total) * GRID_COLS);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = GRID_COLS - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac);

  const spans = [...floors];
  for (let r = 0; r < remainder; r++) {
    spans[order[r].i]++;
  }

  return spans.map((s) => Math.max(1, s));
}

function sortIndicator(isSorted: boolean, sortDir: "asc" | "desc" | undefined) {
  if (!isSorted) return ArrowUpDown;
  return sortDir === "asc" ? ArrowUp : ArrowDown;
}

const SKELETON_KEYS = ["s1", "s2", "s3", "s4"];

function SkeletonRows<T>({ columns, spans }: { columns: Array<DataTableColumn<T>>; spans: number[] }) {
  return (
    <>
      {SKELETON_KEYS.map((k) => (
        <div key={k} className="px-4 py-3 grid grid-cols-12 gap-3 items-center bg-white">
          {columns.map((c, i) => (
            <div key={`${k}-${c.key}`} className={colClass(spans[i])}>
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  rowKey,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  sortBy,
  sortDir,
  onSort,
}: DataTableProps<T>) {
  const spans = resolveColSpans(columns);

  return (
    <div className="rounded-lg border border-border divide-y overflow-hidden bg-white w-full">
      <div className="px-4 py-2.5 grid grid-cols-12 gap-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold bg-[#F8FAFC]">
        {columns.map((c, i) => {
          const isSorted = sortBy === c.key;
          const Indicator = sortIndicator(isSorted, sortDir);
          return (
            <div
              key={c.key}
              className={`${colClass(spans[i])} ${c.align === "right" ? "text-right" : ""} ${c.sortable ? "cursor-pointer select-none hover:text-foreground transition-colors" : ""}`}
              onClick={() => c.sortable && onSort?.(c.key)}
              role={c.sortable ? "button" : undefined}
            >
              <span className={`inline-flex items-center gap-1 ${c.align === "right" ? "justify-end w-full" : ""}`}>
                {c.header}
                {c.sortable && (
                  <Indicator className={`size-3 ${isSorted ? "text-primary" : "opacity-50"}`} />
                )}
              </span>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="min-h-[220px]">
          <SkeletonRows columns={columns} spans={spans} />
        </div>
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon ?? ArrowUpDown}
          title={emptyTitle ?? "No records"}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        rows.map((row) => (
          <div
            key={rowKey(row)}
            className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-sm bg-white hover:bg-[#F8FAFC]/80 transition-colors"
          >
            {columns.map((c, i) => (
              <div
                key={c.key}
                className={`${colClass(spans[i])} ${c.align === "right" ? "text-right" : ""} min-w-0 ${c.key === "actions" ? "shrink-0 whitespace-nowrap" : ""}`}
              >
                {c.cell(row)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
