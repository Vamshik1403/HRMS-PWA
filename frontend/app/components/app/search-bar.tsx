"use client";

import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { listControlClass } from "./list-ui-styles";
import { cn } from "@/app/utils/cn";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder, className }: SearchBarProps) {
  return (
    <div
      className={cn(
        /* Grow to ~60–65%+ of the toolbar; do not cap width (ml-auto siblings steal space). */
        "relative min-w-0 w-full flex-1 basis-[60%] sm:min-w-[280px]",
        className,
      )}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        data-hrms-list-control
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search…"}
        className={cn(listControlClass, "w-full pl-10 pr-4")}
      />
    </div>
  );
}
