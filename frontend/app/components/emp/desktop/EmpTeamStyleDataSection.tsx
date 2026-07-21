"use client";

import { useState, type ReactNode } from "react";
import { Filter, LayoutGrid, List, Search } from "lucide-react";
import { Input } from "../../ui/input";
import { cn } from "@/app/utils/cn";

export type TeamListViewMode = "grid" | "list";

export function useTeamListControls(storageKey?: string) {
  const [viewMode, setViewMode] = useState<TeamListViewMode>(() => {
    if (!storageKey || typeof window === "undefined") return "list";
    return localStorage.getItem(storageKey) === "grid" ? "grid" : "list";
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const selectViewMode = (mode: TeamListViewMode) => {
    setViewMode(mode);
    if (storageKey && typeof window !== "undefined") {
      localStorage.setItem(storageKey, mode);
    }
  };

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setSearchQuery("");
      return !open;
    });
  };

  return {
    viewMode,
    selectViewMode,
    searchOpen,
    searchQuery,
    setSearchQuery,
    toggleSearch,
    filterOpen,
    setFilterOpen,
    toggleFilter: () => setFilterOpen((open) => !open),
  };
}

export function EmpTeamStyleDataSection({
  title,
  subtitle,
  leading,
  actions,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search…",
  filterOpen,
  onToggleFilter,
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
  const showToolbar =
    title ||
    subtitle ||
    leading ||
    actions ||
    onToggleSearch ||
    onToggleFilter ||
    (showViewToggle && onViewModeChange);

  const controlButtons = (
    <>
      {searchOpen && onSearchChange ? (
        <div className="relative w-full sm:w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder={searchPlaceholder}
            value={searchQuery ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
      ) : null}

      {onToggleFilter ? (
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            aria-label="Filter"
            onClick={onToggleFilter}
            className={cn(
              "rounded-md p-2 transition-colors",
              filterOpen
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Filter className="size-4" />
          </button>
        </div>
      ) : null}

      {showViewToggle && onViewModeChange ? (
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            aria-label="Grid view"
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "rounded-md p-2 transition-colors",
              viewMode === "grid"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            aria-label="List view"
            onClick={() => onViewModeChange("list")}
            className={cn(
              "rounded-md p-2 transition-colors",
              viewMode === "list"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="size-4" />
          </button>
        </div>
      ) : null}

      {onToggleSearch ? (
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            aria-label="Search"
            onClick={onToggleSearch}
            className={cn(
              "rounded-md p-2 transition-colors",
              searchOpen
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Search className="size-4" />
          </button>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="space-y-4">
      {showToolbar ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {leading ? <div className="flex items-center gap-2 shrink-0">{leading}</div> : null}

            {title || subtitle ? (
              <div className="shrink-0">
                {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
                {subtitle ? <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">{controlButtons}</div>

            {actions ? <div className="flex items-center gap-2 ml-auto shrink-0">{actions}</div> : null}
          </div>

          {filterOpen && filterContent ? (
            <div className="flex flex-wrap items-center gap-2">{filterContent}</div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : empty ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
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
