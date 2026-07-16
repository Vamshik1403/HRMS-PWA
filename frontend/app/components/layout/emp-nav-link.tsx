"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/app/utils/cn";
import type { EmpSidebarNavItem } from "./emp-portal-sidebar-navigation";
import { isEmpNavItemActive } from "./emp-portal-sidebar-navigation";

interface EmpNavLinkProps {
  item: EmpSidebarNavItem;
  pathname: string;
  collapsed: boolean;
}

export function EmpNavLink({ item, pathname, collapsed }: EmpNavLinkProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = isEmpNavItemActive(item, pathname, searchParams);
  const Icon = item.icon;

  const layout = collapsed ? "px-2 py-2 justify-center" : "px-3 py-2";
  const stateClasses = active
    ? "bg-accent text-accent-foreground shadow-sm"
    : "text-muted-foreground hover:text-foreground hover:bg-accent/60";

  const content = (
    <div
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md transition-all duration-150",
        layout,
        stateClasses,
      )}
    >
      {active && !collapsed && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
      )}
      <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
      {!collapsed && <span className="text-sm flex-1 truncate">{item.label}</span>}
    </div>
  );

  const [hrefPath, hrefQuery] = item.href.split("?");
  const isCurrent =
    pathname === hrefPath &&
    (!hrefQuery || hrefQuery === searchParams.toString() || new URLSearchParams(hrefQuery).get("tab") === searchParams.get("tab"));

  return (
    <Link
      href={item.href}
      onClick={(e) => {
        if (isCurrent) {
          e.preventDefault();
          router.refresh();
        }
      }}
    >
      {content}
    </Link>
  );
}
