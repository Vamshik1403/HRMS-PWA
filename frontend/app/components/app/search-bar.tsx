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
    <div className={cn("relative flex-1 min-w-[200px] max-w-md", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        data-hrms-list-control
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search…"}
        className={cn(listControlClass, "pl-9")}
      />
    </div>
  );
}
