"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import {
  EMP_MORE_GROUP_ICONS,
  getVisibleEmpMoreSections,
  groupEmpMoreSections,
  type EmpMoreGroupKey,
} from "@/app/components/layout/emp-portal-more-sections";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { cn } from "@/app/utils/cn";

export function moreGroupHref(group: EmpMoreGroupKey) {
  return `/empMore?group=${group}`;
}

export function resolveMoreGroupParam(
  searchParams: URLSearchParams,
  available: EmpMoreGroupKey[],
): EmpMoreGroupKey | null {
  const raw = searchParams.get("group") as EmpMoreGroupKey | null;
  if (raw && available.includes(raw)) return raw;
  return available[0] ?? null;
}

/** Category tabs rendered directly under the portal top navbar on /empMore. */
export function EmpMoreCategoryTabNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isManagerView } = useEmpManagerScope();

  if (pathname !== "/empMore" && !pathname?.startsWith("/empMore/")) {
    return null;
  }

  const sections = getVisibleEmpMoreSections(isManagerView);
  const groups = groupEmpMoreSections(sections);
  if (groups.length === 0) return null;

  const active = resolveMoreGroupParam(
    searchParams,
    groups.map((g) => g.key),
  );

  return (
    <div className="shrink-0 border-b border-border bg-background">
      {/* Outer clip hides the native horizontal scrollbar while keeping swipe/scroll. */}
      <div className="overflow-hidden">
        <div
          className="emp-more-category-tabs flex gap-0.5 overflow-x-auto px-4 pb-4 -mb-4"
          role="tablist"
          aria-label="Module categories"
        >
          {groups.map((group) => {
            const isActive = group.key === active;
            return (
              <Link
                key={group.key}
                href={moreGroupHref(group.key)}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors duration-150",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon
                  icon={EMP_MORE_GROUP_ICONS[group.key]}
                  className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")}
                />
                {group.title}
              </Link>
            );
          })}
        </div>
      </div>
      <style>{`
        .emp-more-category-tabs {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .emp-more-category-tabs::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent;
        }
      `}</style>
    </div>
  );
}
