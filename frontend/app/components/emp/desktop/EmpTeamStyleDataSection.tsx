"use client";

import { useState, type ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";
import { FilterBar } from "@/app/components/app/filter-bar";
import { listCardClass, listIconButtonClass } from "@/app/components/app/list-ui-styles";
import { cn } from "@/app/utils/cn";

export type TeamListViewMode = "grid" | "list";

export function useTeamListControls(storageKey?: string) {
  const [viewMode, setViewMode] = useState<TeamListViewMode>(() => {
    if (!storageKey || typeof window === "undefined") return "list";
    return localStorage.getItem(storageKey) === "grid" ? "grid" : "list";
  });
  /** Always-visible search (admin FilterBar); kept for API compatibility. */
  const [searchOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  /** Filters stay visible in the toolbar; kept for API compatibility. */
  const [filterOpen, setFilterOpen] = useState(true);

  const selectViewMode = (mode: TeamListViewMode) => {
    setViewMode(mode);
    if (storageKey && typeof window !== "undefined") {
      localStorage.setItem(storageKey, mode);
    }
  };

  return {
    viewMode,
    selectViewMode,
    searchOpen,
    searchQuery,
    setSearchQuery,
    toggleSearch: () => undefined,
    filterOpen,
    setFilterOpen,
    toggleFilter: () => setFilterOpen(true),
  };
}

export function EmpTeamStyleDataSection({
  title,
  subtitle,
  leading,
  actions,
  searchOpen: _searchOpen,
  onToggleSearch: _onToggleSearch,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search…",
  filterOpen: _filterOpen,
  onToggleFilter: _onToggleFilter,
  filterContent,
  viewMode,
  onViewModeChange,
  showViewToggle = true,
  loading,
  empty,
  emptyMessage = "No records found.",
  listContent,
  gridContent,
}: {
  title?: string;
  subtitle?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  searchOpen?: boolean;
  onToggleSearch?: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filterOpen?: boolean;
  onToggleFilter?: () => void;
  filterContent?: ReactNode;
  viewMode?: TeamListViewMode;
  onViewModeChange?: (mode: TeamListViewMode) => void;
  showViewToggle?: boolean;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  listContent: ReactNode;
  gridContent?: ReactNode;
}) {
  void _searchOpen;
  void _onToggleSearch;
  void _filterOpen;
  void _onToggleFilter;

  const showHeader = title || subtitle || leading;
  const showViewControls = showViewToggle && onViewModeChange && gridContent;

  return (
    <div className="space-y-4 page-content-enter">
      {showHeader ? (
        <div className="flex flex-wrap items-start gap-3">
          {leading ? <div className="flex items-center gap-2 shrink-0">{leading}</div> : null}
          {title || subtitle ? (
            <div className="min-w-0 flex-1">
              {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
              {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <FilterBar
        search={
          onSearchChange
            ? {
                value: searchQuery ?? "",
                onChange: onSearchChange,
                placeholder: searchPlaceholder,
              }
            : undefined
        }
        filters={filterContent}
        filtersPlacement={filterContent ? "popover" : "inline"}
        trailing={
          <>
            {showViewControls ? (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label="Grid view"
                  title="Grid view"
                  onClick={() => onViewModeChange!("grid")}
                  className={cn(
                    listIconButtonClass,
                    viewMode === "grid" && "bg-muted text-foreground",
                  )}
                >
                  <LayoutGrid className="size-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  title="List view"
                  onClick={() => onViewModeChange!("list")}
                  className={cn(
                    listIconButtonClass,
                    viewMode === "list" && "bg-muted text-foreground",
                  )}
                >
                  <List className="size-4" strokeWidth={1.75} />
                </button>
              </div>
            ) : null}
            {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
          </>
        }
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : empty ? (
        <div className={cn(listCardClass, "p-8 text-center text-muted-foreground")}>
          {emptyMessage}
        </div>
      ) : viewMode === "grid" && gridContent ? (
        gridContent
      ) : (
        listContent
      )}
    </div>
  );
}
