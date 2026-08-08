"use client";

import { useRef, useState, type ReactNode } from "react";
import { Download, ListFilter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SearchBar } from "./search-bar";
import {
  listIconButtonClass,
  listSelectTriggerClass,
  listToolbarClass,
} from "./list-ui-styles";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/app/utils/cn";
import { useListToolbarActions } from "@/app/components/layout/list-toolbar-actions-context";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  width?: string;
  ariaLabel?: string;
}

export function FilterSelect({
  id,
  value,
  onChange,
  options,
  width,
  ariaLabel,
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        data-hrms-list-control
        className={cn(listSelectTriggerClass, width ?? "w-full min-w-[11rem]")}
        aria-label={ariaLabel ?? id}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function exportNearestTableCsv(fromEl: HTMLElement | null) {
  if (typeof document === "undefined" || !fromEl) return;
  const root = fromEl.closest(".page-content-enter") || fromEl.parentElement || document.body;
  const table = root.querySelector("table");
  if (!table) return;

  const rows = Array.from(table.querySelectorAll("tr"));
  const csv = rows
    .map((tr) =>
      Array.from(tr.querySelectorAll("th,td"))
        .map((cell) => {
          const text = (cell.textContent || "").replace(/\s+/g, " ").trim();
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface FilterBarProps {
  search?: {
    value: string;
    onChange: (s: string) => void;
    placeholder?: string;
  };
  filters?: ReactNode;
  /**
   * inline = filters sit beside search.
   * popover = filters open from the Filter icon (default — keeps Add on the same row).
   */
  filtersPlacement?: "inline" | "popover";
  trailing?: ReactNode;
  /** Optional override for the toolbar Filter button (ignored when filtersPlacement is popover). */
  onFilterClick?: () => void;
  /** Optional override for the toolbar Download button. Defaults to CSV of the nearest table. */
  onExport?: () => void;
  /** Hide Filter / Download icon buttons (default false — shown on all list pages). */
  hideToolbarActions?: boolean;
}

export function FilterBar({
  search,
  filters,
  filtersPlacement = "popover",
  trailing,
  onFilterClick,
  onExport,
  hideToolbarActions = false,
}: FilterBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const registeredActions = useListToolbarActions();
  const trailingNode = trailing ?? registeredActions;
  const hasFilters = Boolean(filters);
  const popoverMode = filtersPlacement === "popover" && hasFilters;
  const showFilterButton = !hideToolbarActions && (hasFilters || !!onFilterClick || filtersPlacement === "inline");

  const handleFilterClick = () => {
    if (onFilterClick) {
      onFilterClick();
      return;
    }
    const firstControl = filtersRef.current?.querySelector<HTMLElement>(
      "button, select, [data-hrms-list-control], input",
    );
    firstControl?.focus();
    firstControl?.click();
  };

  const handleExportClick = () => {
    if (onExport) {
      onExport();
      return;
    }
    exportNearestTableCsv(barRef.current);
  };

  return (
    <div ref={barRef} data-hrms-filter-bar className={listToolbarClass}>
      {search ? (
        <SearchBar
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
          className="min-w-0 flex-1 basis-0 sm:min-w-[220px]"
        />
      ) : (
        <div className="min-w-0 flex-1" />
      )}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 sm:gap-3">
        {!popoverMode && hasFilters ? (
          <div ref={filtersRef} className="flex flex-wrap items-center gap-3">
            {filters}
          </div>
        ) : null}
        {!hideToolbarActions ? (
          <div className="flex shrink-0 items-center gap-2.5">
            {showFilterButton ? (
              popoverMode ? (
                <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        listIconButtonClass,
                        filterPopoverOpen && "bg-muted text-foreground",
                      )}
                      aria-label="Filters"
                      title="Filters"
                    >
                      <ListFilter className="size-4" strokeWidth={1.75} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[min(92vw,320px)] border border-border bg-popover p-3 shadow-md"
                  >
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Filters
                    </p>
                    <div className="flex flex-col gap-2.5 [&_[data-hrms-list-control]]:w-full">
                      {filters}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <button
                  type="button"
                  className={listIconButtonClass}
                  aria-label="Filters"
                  title="Filters"
                  onClick={handleFilterClick}
                >
                  <ListFilter className="size-4" strokeWidth={1.75} />
                </button>
              )
            ) : null}
            <button
              type="button"
              className={listIconButtonClass}
              aria-label="Download"
              title="Download"
              onClick={handleExportClick}
            >
              <Download className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        ) : null}
        {trailingNode ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3 [&_button]:h-[46px] [&_button]:rounded-xl [&_button:not(.size-11)]:px-6">
            {trailingNode}
          </div>
        ) : null}
      </div>
    </div>
  );
}
