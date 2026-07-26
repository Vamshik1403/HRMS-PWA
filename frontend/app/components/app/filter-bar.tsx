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
        className={cn(listSelectTriggerClass, width ?? "w-44 shrink-0")}
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
   * inline = filters sit beside search (admin lists).
   * popover = filters open from the Filter icon (employee portal lists).
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
  filtersPlacement = "inline",
  trailing,
  onFilterClick,
  onExport,
  hideToolbarActions = false,
}: FilterBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const popoverMode = filtersPlacement === "popover" && !!filters;

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
    <div ref={barRef} className={listToolbarClass}>
      {search ? (
        <SearchBar
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
        />
      ) : null}
      <div className="flex w-full shrink-0 flex-wrap items-center gap-3 sm:w-auto">
        {!popoverMode ? (
          <div ref={filtersRef} className="flex flex-wrap items-center gap-3">
            {filters}
          </div>
        ) : null}
        {!hideToolbarActions ? (
          <div className="flex shrink-0 items-center gap-2.5">
            {popoverMode ? (
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
                  className="w-auto max-w-[min(92vw,420px)] border border-border bg-popover p-3 shadow-md"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Filters
                  </p>
                  <div className="flex flex-wrap items-center gap-2">{filters}</div>
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
            )}
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
        {trailing ? <div className="flex shrink-0 items-center gap-3">{trailing}</div> : null}
      </div>
    </div>
  );
}
