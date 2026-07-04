"use client";

import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { SearchBar } from "./search-bar";
import { listSelectTriggerClass } from "./list-ui-styles";
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
        className={cn(listSelectTriggerClass, width ?? "w-44")}
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

interface FilterBarProps {
  search?: {
    value: string;
    onChange: (s: string) => void;
    placeholder?: string;
  };
  filters?: ReactNode;
  trailing?: ReactNode;
}

export function FilterBar({ search, filters, trailing }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 w-full">
      {search && (
        <SearchBar
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
        />
      )}
      {filters}
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
