"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/utils/cn";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { filterEmpSidebarNavigation } from "./emp-portal-sidebar-navigation";
import { getVisibleEmpMoreSections } from "./emp-portal-more-sections";

type ModuleHit = {
  label: string;
  href: string;
  group: string;
};

function buildModuleHits(isManager: boolean): ModuleHit[] {
  const fromSidebar = filterEmpSidebarNavigation(isManager).flatMap((group) =>
    group.items.map((item) => ({
      label: item.label,
      href: item.href,
      group: group.label,
    })),
  );
  const fromMore = getVisibleEmpMoreSections(isManager).map((section) => ({
    label: section.label,
    href: section.href,
    group: section.group
      ? section.group.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Modules",
  }));

  const seen = new Set<string>();
  const hits: ModuleHit[] = [];
  for (const hit of [...fromSidebar, ...fromMore]) {
    const key = hit.href.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(hit);
  }
  return hits;
}

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
  const router = useRouter();
  const { isManagerView } = useEmpManagerScope();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const modules = useMemo(() => buildModuleHits(isManagerView), [isManagerView]);

  const query = value.trim();
  const results = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return [];
    return modules.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q),
    );
  }, [modules, query]);

  const showDropdown = open && query.length > 0;

  useEffect(() => {
    if (!open) return;
    // preventScroll stops the browser from jumping/shaking the page on focus
    inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !rootRef.current) return;
      if (!rootRef.current.contains(target)) {
        onOpenChange(false);
        onChange("");
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        onChange("");
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange, onChange]);

  const navigate = (href: string) => {
    onOpenChange(false);
    onChange("");
    router.push(href);
  };

  return (
    <div
      ref={rootRef}
      className="relative flex size-9 shrink-0 items-center justify-end contain-layout"
    >
      {/*
        Clip-expand to the left of the icon.
        Root stays size-9 forever so navbar icons never move / page never reflows.
        overflow-hidden clips the 240px input while width animates (avoids scrollbar flash).
      */}
      <div
        className={cn(
          "absolute right-full top-1/2 z-[80] -translate-y-1/2 overflow-hidden transition-[width,margin,opacity] duration-[250ms] ease-in-out will-change-[width]",
          open ? "mr-2 w-[240px] opacity-100" : "mr-0 w-0 opacity-0 pointer-events-none",
        )}
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            // Keep caret without letting the browser scroll the page into view
            inputRef.current?.focus({ preventScroll: true });
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (results.length === 0) return;
              setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[activeIndex]) {
              e.preventDefault();
              navigate(results[activeIndex].href);
            }
          }}
          placeholder={placeholder || "Search modules…"}
          tabIndex={open ? 0 : -1}
          className="h-9 w-[240px] min-w-[240px] rounded-lg border border-[#E5E7EB] bg-white text-[13px] shadow-none focus-visible:ring-[#4F46E5]/20"
        />
      </div>

      {/* Dropdown sits outside the clip wrapper so it can show below the bar */}
      {showDropdown ? (
        <div className="absolute right-full top-[calc(100%+8px)] z-[80] mr-2 w-[240px] max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg overscroll-contain">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-muted-foreground">
              No modules match &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((item, index) => (
              <button
                key={`${item.href}-${item.label}`}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/60",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => navigate(item.href)}
              >
                <span className="truncate text-[13px] font-medium">{item.label}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.group}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? "Collapse search" : "Expand search"}
        aria-expanded={open}
        onMouseDown={(e) => {
          // Avoid focus scroll jump from the button itself
          e.preventDefault();
        }}
        onClick={() => {
          if (open) {
            onOpenChange(false);
            onChange("");
          } else {
            onOpenChange(true);
          }
        }}
        className="relative z-10 inline-flex size-9 items-center justify-center rounded-full text-[#464554] transition-colors duration-150 hover:bg-[#eef4ff] hover:text-[#4648d4]"
      >
        <Search className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
