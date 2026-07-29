"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { LayoutGrid, Search } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import {
  getVisibleEmpMoreSections,
  groupEmpMoreSections,
} from "@/app/components/layout/emp-portal-more-sections";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import {
  moreSectionBadgeCount,
  useEmpSidebarBadges,
} from "@/app/hooks/useEmpSidebarBadges";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { cn } from "@/app/utils/cn";

export function EmpMoreServicesGrid() {
  const isDesktop = useEmpPortalDesktop();
  const { isManagerView } = useEmpManagerScope();
  const badges = useEmpSidebarBadges();
  const [query, setQuery] = useState("");

  const sections = useMemo(
    () => getVisibleEmpMoreSections(isManagerView),
    [isManagerView],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.label.toLowerCase().includes(q));
  }, [sections, query]);

  const groups = useMemo(() => groupEmpMoreSections(filtered), [filtered]);

  const body = (
    <div className="space-y-8">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search modules"
          className="h-11 pl-10 rounded-xl bg-card border-border shadow-sm"
        />
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No modules match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.key}>
            <h2 className="text-sm font-semibold text-foreground mb-4">{group.title}</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-3 gap-y-6">
              {group.items.map((section) => {
                const badge = moreSectionBadgeCount(section.id, badges);
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    className="group flex flex-col items-center gap-2.5 text-center"
                  >
                    <div
                      className={cn(
                        "relative w-full max-w-[92px] aspect-square rounded-xl border border-border bg-card shadow-sm",
                        "flex items-center justify-center transition-all duration-150",
                        "group-hover:border-primary/30 group-hover:shadow-md group-hover:-translate-y-0.5",
                      )}
                    >
                      <Icon icon={section.icon} className={cn("size-9", section.iconClassName)} />
                      {badge > 0 ? (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[11px] sm:text-xs font-medium text-muted-foreground leading-snug px-1 group-hover:text-foreground">
                      {section.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <EmpDesktopPage title="More" description="Browse modules and services" icon={LayoutGrid}>
        {body}
      </EmpDesktopPage>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-[22px] font-bold text-foreground mb-6">More</h1>
      {body}
    </div>
  );
}
