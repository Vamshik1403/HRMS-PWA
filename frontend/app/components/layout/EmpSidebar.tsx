"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/app/utils/cn";
import { SidebarBrand } from "../app/sidebar-brand";
import { EmpNavLink } from "./emp-nav-link";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { useEmpSidebarBadges, sidebarBadgeForHref } from "@/app/hooks/useEmpSidebarBadges";
import { filterEmpSidebarNavigation, type EmpSidebarNavGroup } from "./emp-portal-sidebar-navigation";

interface EmpSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onRefresh?: () => void;
}

function EmpSidebarNavGroup({
  group,
  pathname,
  collapsed,
  badges,
}: {
  group: EmpSidebarNavGroup;
  pathname: string;
  collapsed: boolean;
  badges: ReturnType<typeof useEmpSidebarBadges>;
}) {
  if (group.items.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <div className="mb-1 px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {group.label}
        </div>
      )}
      {group.items.map((item) => (
        <EmpNavLink
          key={item.id}
          item={item}
          pathname={pathname}
          collapsed={collapsed}
          badgeCount={sidebarBadgeForHref(item.href, badges)}
        />
      ))}
    </div>
  );
}

export function EmpSidebar({ collapsed, onToggle, onRefresh }: EmpSidebarProps) {
  const pathname = usePathname();
  const { isManagerView } = useEmpManagerScope();
  const badges = useEmpSidebarBadges();
  const groups = filterEmpSidebarNavigation(isManagerView);

  return (
    <aside
      className={cn(
        "z-40 flex h-full min-h-0 shrink-0 flex-col border-r border-border bg-background shadow-sm transition-[width] duration-300",
        collapsed ? "w-14" : "w-[210px]",
      )}
    >
      <SidebarBrand
        collapsed={collapsed}
        homeHref="/empdashboard"
        onRefresh={onRefresh}
        onToggle={onToggle}
      />

      <nav className="scrollbar-auto-hide min-h-0 flex-1 space-y-5 overflow-y-auto px-0.5 py-3">
        {groups.map((group) => (
          <EmpSidebarNavGroup
            key={group.label}
            group={group}
            pathname={pathname}
            collapsed={collapsed}
            badges={badges}
          />
        ))}
      </nav>
    </aside>
  );
}
