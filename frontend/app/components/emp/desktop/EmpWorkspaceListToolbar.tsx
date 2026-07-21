"use client";

import { Filter, Search } from "lucide-react";
import { Input } from "../../ui/input";
import { cn } from "@/app/utils/cn";

export function EmpWorkspaceListToolbar({
  title,
  subtitle,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search…",
  filterOpen,
  onToggleFilter,
  filterContent,
  actions,
}: {
  title: string;
  subtitle?: string;
  searchOpen?: boolean;
  onToggleSearch?: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filterOpen?: boolean;
  onToggleFilter?: () => void;
  filterContent?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {searchOpen && onSearchChange ? (
            <div className="relative w-full sm:w-56">
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

          {actions}
        </div>
      </div>

      {filterOpen && filterContent ? (
        <div className="flex flex-wrap items-center gap-2">{filterContent}</div>
      ) : null}
    </div>
  );
}
