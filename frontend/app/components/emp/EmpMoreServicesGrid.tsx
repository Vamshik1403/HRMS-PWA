"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { LayoutGrid } from "lucide-react";
import {
  EMP_MORE_GROUP_ICONS,
  getVisibleEmpMoreSections,
  groupEmpMoreSections,
  type EmpMoreGroupKey,
  type EmpMoreSection,
} from "@/app/components/layout/emp-portal-more-sections";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import {
  moreSectionBadgeCount,
  useEmpSidebarBadges,
} from "@/app/hooks/useEmpSidebarBadges";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { moreGroupHref, resolveMoreGroupParam } from "./EmpMoreCategoryTabNav";
import { cn } from "@/app/utils/cn";

function ModuleCard({
  section,
  badge,
  index,
}: {
  section: EmpMoreSection;
  badge: number;
  index: number;
}) {
  return (
    <Link
      href={section.href}
      className={cn(
        "group relative flex w-[104px] flex-col items-center gap-2 outline-none",
        "transition-transform duration-200 ease-out hover:-translate-y-0.5",
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div
        className={cn(
          "relative flex aspect-square w-full items-center justify-center rounded-2xl",
          "bg-[#F3F4F6] transition-colors duration-200 group-hover:bg-[#E8ECF1]",
        )}
      >
        <Icon
          icon={section.icon}
          className={cn("size-11", section.iconClassName)}
        />
        {badge > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </div>
      <p className="w-full text-center text-[12px] font-medium leading-snug text-foreground">
        {section.label}
      </p>
    </Link>
  );
}

export function EmpMoreServicesGrid() {
  const isDesktop = useEmpPortalDesktop();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isManagerView } = useEmpManagerScope();
  const badges = useEmpSidebarBadges();
  const [mobileGroup, setMobileGroup] = useState<EmpMoreGroupKey | null>(null);

  const sections = useMemo(
    () => getVisibleEmpMoreSections(isManagerView),
    [isManagerView],
  );

  const allGroups = useMemo(() => groupEmpMoreSections(sections), [sections]);
  const availableKeys = useMemo(() => allGroups.map((g) => g.key), [allGroups]);

  const urlGroup = resolveMoreGroupParam(searchParams, availableKeys);

  useEffect(() => {
    if (allGroups.length === 0) return;
    if (isDesktop) {
      if (!searchParams.get("group") && allGroups[0]) {
        router.replace(moreGroupHref(allGroups[0].key), { scroll: false });
      }
      return;
    }
    if (!mobileGroup || !availableKeys.includes(mobileGroup)) {
      setMobileGroup(allGroups[0]?.key ?? null);
    }
  }, [allGroups, availableKeys, isDesktop, mobileGroup, router, searchParams]);

  const activeGroup = isDesktop ? urlGroup : mobileGroup ?? urlGroup;
  const activeMeta = allGroups.find((g) => g.key === activeGroup) || allGroups[0] || null;

  const categoryContent = activeMeta ? (
    <div key={activeMeta.key} className="animate-fade-in">
      {activeMeta.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted">
            <LayoutGrid className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">No modules available in this category.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose another category or ask your admin for access.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-8 gap-y-8 sm:gap-x-10 sm:gap-y-10">
          {activeMeta.items.map((section, index) => (
            <ModuleCard
              key={section.id}
              section={section}
              badge={moreSectionBadgeCount(section.id, badges)}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  ) : (
    <p className="py-12 text-center text-sm text-muted-foreground">No modules available.</p>
  );

  if (isDesktop) {
    return (
      <EmpDesktopPage title="More" description="Browse modules and services" icon={LayoutGrid}>
        {categoryContent}
      </EmpDesktopPage>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-foreground">More</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Browse modules and services</p>
      </div>

      <div className="overflow-hidden border-b border-border">
        <div
          className="emp-more-mobile-tabs flex gap-0.5 overflow-x-auto pb-4 -mb-4"
          role="tablist"
        >
          {allGroups.map((group) => {
            const active = group.key === activeGroup;
            return (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMobileGroup(group.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground",
                )}
              >
                <Icon icon={EMP_MORE_GROUP_ICONS[group.key]} className="size-4" />
                {group.title}
              </button>
            );
          })}
        </div>
      </div>
      <style>{`
        .emp-more-mobile-tabs {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .emp-more-mobile-tabs::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent;
        }
      `}</style>

      {categoryContent}
    </div>
  );
}
