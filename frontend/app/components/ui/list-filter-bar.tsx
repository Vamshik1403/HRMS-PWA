"use client";

import type { ReactNode } from "react";
import { Search, Filter } from "lucide-react";
import { Card, CardContent } from "./card";
import { Button } from "./button";
import { Input } from "./input";
import { Badge } from "./badge";
import { cn } from "@/app/utils/cn";

interface ListFilterBarProps {
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  countLabel: string;
  onFilterClick?: () => void;
  filterCount?: number;
  filterLabel?: string;
  className?: string;
  actions?: ReactNode;
}

export function ListFilterBar({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  countLabel,
  onFilterClick,
  filterCount = 0,
  filterLabel = "Filter",
  className,
  actions,
}: ListFilterBarProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 w-full min-h-12">
          {onFilterClick && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onFilterClick}
              className="h-10 shrink-0 rounded-lg"
              title="Filter"
            >
              <Filter className="size-4" />
              {filterLabel}
              {filterCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {filterCount}
                </Badge>
              )}
            </Button>
          )}

          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-10 pl-10"
            />
          </div>

          {actions}

          <Badge variant="secondary" className="h-10 px-3 flex items-center shrink-0 rounded-lg font-medium">
            {countLabel}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
