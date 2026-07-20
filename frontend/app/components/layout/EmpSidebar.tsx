"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/app/utils/cn";
import { SidebarBrand } from "../app/sidebar-brand";
import { EmpNavLink } from "./emp-nav-link";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
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
}: {
  group: EmpSidebarNavGroup;
  pathname: string;
  collapsed: boolean;
}) {
  if (group.items.length === 0) return null;

  return (
    <div className="space-y-1">
      {!collapsed && (
        <div className="px-2 mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold">
          {group.label}
        </div>
      )}
      {group.items.map((item) => (
        <EmpNavLink
          key={`${group.label}-${item.href}-${item.label}`}
          item={item}
          pathname={pathname}
          collapsed={collapsed}
        />
      ))}
    </div>
  );
}

export function EmpSidebar({ collapsed, onToggle, onRefresh }: EmpSidebarProps) {
  const pathname = usePathname();
  const { isManagerView } = useEmpManagerScope();
  const groups = filterEmpSidebarNavigation(isManagerView);

  return (
    <aside
      className={cn(
        "shrink-0 border-r bg-card/40 backdrop-blur-sm transition-[width] duration-300 flex flex-col h-full min-h-0 z-40",
        collapsed ? "w-14" : "w-52",
      )}
    >
      <SidebarBrand
        collapsed={collapsed}
        homeHref="/empdashboard"
        onRefresh={onRefresh}
        onToggle={onToggle}
      />

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide py-3 px-1.5 space-y-5">
        {groups.map((group) => (
          <EmpSidebarNavGroup
            key={group.label}
            group={group}
            pathname={pathname}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </aside>
  );
}
