"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { DataTable, type DataTableColumn } from "./data-table";
import { listCardClass } from "./list-ui-styles";

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
}: EntityListShellProps<T>) {
  const total = rows?.length ?? 0;
  const description = totalLabel ? totalLabel(total) : `${total} total`;

  return (
    <Card className={listCardClass}>
      <CardHeader className="gap-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          isLoading={isLoading}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          emptyIcon={emptyIcon}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyAction={emptyAction}
        />
      </CardContent>
    </Card>
  );
}
