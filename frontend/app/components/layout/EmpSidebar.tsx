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
    <div className="space-y-0.5">
      {!collapsed && (
        <div className="mb-1 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#5b5f61]">
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
        "z-40 flex h-full min-h-0 shrink-0 flex-col border-r border-[#e5eeff] bg-[#f8f9ff] shadow-[0px_4px_20px_rgba(0,0,0,0.05)] transition-[width] duration-300",
        collapsed ? "w-14" : "w-[184px]",
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
          />
        ))}
      </nav>
    </aside>
  );
}
