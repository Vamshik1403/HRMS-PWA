"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Search } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { getVisibleEmpMoreSections } from "./emp-portal-more-sections";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { cn } from "@/app/utils/cn";

export function EmpPortalGlobalSearch() {
  const { isManagerView } = useEmpManagerScope();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(
    () => getVisibleEmpMoreSections(isManagerView),
    [isManagerView],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sections.filter((s) => s.label.toLowerCase().includes(q));
  }, [sections, query]);

  const showDropdown = open && query.trim().length > 0;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative z-[100] flex-1 max-w-xl">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search all sections..."
        className="h-9 pl-9 rounded-lg bg-muted/50 border-border/60"
      />

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-[100] rounded-xl border border-border bg-background shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No sections match &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {filtered.map((section) => (
                <li key={section.id}>
                  <Link
                    href={section.href}
                    onClick={close}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon icon={section.icon} className={cn("size-5 shrink-0", section.iconClassName)} />
                    <span className="font-medium">{section.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
