"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  EMP_SETUP_TABS_REGISTRY,
  getVisibleSetupTabs,
} from "@/app/components/layout/emp-setup-tabs-registry";
import { cn } from "@/app/utils/cn";

export function setupTabHref(basePath: string, key: string) {
  return `${basePath}?tab=${key}`;
}

export function resolveSetupTabParam(
  searchParams: URLSearchParams,
  available: string[],
): string | null {
  const raw = searchParams.get("tab");
  if (raw && available.includes(raw)) return raw;
  return available[0] ?? null;
}

/** Horizontal setup-section tabs rendered directly under the portal top navbar. */
export function EmpSetupCategoryTabNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = pathname ? EMP_SETUP_TABS_REGISTRY[pathname] : null;
  if (!tabs) return null;

  const visibleTabs = getVisibleSetupTabs(tabs);
  if (visibleTabs.length === 0) return null;

  const active = resolveSetupTabParam(
    searchParams,
    visibleTabs.map((t) => t.key),
  );

  return (
    <div className="shrink-0 border-b border-border bg-background">
      <div className="overflow-hidden">
        <div
          className="emp-setup-category-tabs flex gap-0.5 overflow-x-auto px-4 pb-4 -mb-4"
          role="tablist"
          aria-label="Setup categories"
        >
          {visibleTabs.map((tab) => {
            const isActive = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={setupTabHref(pathname!, tab.key)}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors duration-150",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      <style>{`
        .emp-setup-category-tabs {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .emp-setup-category-tabs::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent;
        }
      `}</style>
    </div>
  );
}
