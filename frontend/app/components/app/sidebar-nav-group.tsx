"use client";

import { NavLink } from "./nav-link";
import type { NavGroup } from "./hrms-navigation";

interface SidebarNavGroupProps {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
}

export function SidebarNavGroup({ group, pathname, collapsed }: SidebarNavGroupProps) {
  if (group.items.length === 0) return null;

  return (
    <div className="space-y-1">
      {!collapsed && (
        <div className="px-3 mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold">
          {group.label}
        </div>
      )}
      {group.items.map((item) => (
        <NavLink key={`${group.label}-${item.href}-${item.label}`} item={item} pathname={pathname} collapsed={collapsed} />
      ))}
    </div>
  );
}
