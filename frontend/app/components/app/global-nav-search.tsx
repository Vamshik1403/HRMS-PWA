"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/utils/cn";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { isDesktopManagerFlagSet } from "@/lib/desktopManager";
import { isCompanyAdminLikeRole } from "@/lib/companyAccess";
import { COMPANY_HUB_TILES, filterCompanyHubTiles } from "@/app/my-company/hubs";
import { isHubTabAllowed, useProductAccess } from "@/lib/productAccess";
import { buildNavContext, filterNavigation } from "./hrms-navigation";

interface SearchHit {
  label: string;
  href: string;
  group: string;
}

export function GlobalNavSearch({
  className,
  inputClassName,
  alwaysVisible = false,
}: {
  className?: string;
  inputClassName?: string;
  /** When true, show on mobile too (dashboard embedded search). */
  alwaysVisible?: boolean;
} = {}) {
  const router = useRouter();
  const user = useCurrentUser();
  const productAccess = useProductAccess();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo<SearchHit[]>(() => {
    if (!user) return [];
    const ctx = buildNavContext(user, isDesktopManagerFlagSet());
    const navItems = filterNavigation(ctx).flatMap((group) =>
      group.items
        .filter((item) => !item.comingSoon)
        .map((item) => ({ label: item.label, href: item.href, group: group.label })),
    );
    if (!isCompanyAdminLikeRole(user.role)) return navItems;

    const tileItems = filterCompanyHubTiles(COMPANY_HUB_TILES, isHubTabAllowed)
      .filter((tile) => tile.tabs.some((tab) => !tab.comingSoon))
      .map((tile) => ({
      label: tile.label,
      href: `/my-company/${tile.id}`,
      group: "Modules",
    }));
    const withoutLauncher = navItems.filter((item) => item.href !== "/my-company");
    return [...tileItems, ...withoutLauncher];
  }, [user, productAccess]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 8);
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          item.href.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [items, query]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex-1 max-w-md",
        alwaysVisible ? "block" : "hidden sm:block",
        className,
      )}
    >
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[activeIndex]) {
            e.preventDefault();
            navigate(results[activeIndex].href);
          }
        }}
        placeholder="Search employees, modules…"
        className={cn(
          "h-10 pl-10 pr-14 rounded-md border border-border bg-muted/40 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/25 transition-colors",
          inputClassName,
        )}
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-5 items-center rounded border border-border/60 bg-background/80 px-1.5 text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-lg border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {results.map((item, index) => (
            <button
              key={`${item.href}-${item.label}`}
              type="button"
              className={cn(
                "w-full px-3 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-accent/60 transition-colors",
                index === activeIndex && "bg-accent text-accent-foreground",
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => navigate(item.href)}
            >
              <span className="text-sm font-medium truncate">{item.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{item.group}</span>
            </button>
          ))}
        </div>
      )}
      {open && query && results.length === 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-lg border bg-popover shadow-md px-3 py-4 text-sm text-muted-foreground">
          No pages match &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
