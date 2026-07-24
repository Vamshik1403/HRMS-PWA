"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/utils/cn";

export function EmpPortalExpandableSearch({
  open,
  onOpenChange,
  value,
  onChange,
  placeholder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !rootRef.current) return;
      if (!rootRef.current.contains(target)) {
        onOpenChange(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="flex items-center">
      <button
        type="button"
        aria-label={open ? "Collapse search" : "Expand search"}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="relative inline-flex size-9 items-center justify-center rounded-full text-[#464554] transition-colors duration-150 hover:bg-[#eef4ff] hover:text-[#4648d4]"
      >
        <Search className="size-5" strokeWidth={1.75} />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-[width,margin,opacity] duration-[250ms] ease-in-out",
          open ? "ml-2 w-[240px] opacity-100" : "ml-0 w-0 opacity-0",
        )}
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-[240px] rounded-lg border border-[#E5E7EB] bg-white text-[13px] shadow-none focus-visible:ring-[#4F46E5]/20"
        />
      </div>
    </div>
  );
}
