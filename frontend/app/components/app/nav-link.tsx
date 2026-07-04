"use client";

import Link from "next/link";
import { cn } from "@/app/utils/cn";
import { Badge } from "@/app/components/ui/badge";
import type { NavItem } from "./hrms-navigation";
import { dispatchSidebarMainPageClick } from "./hrms-navigation";

interface NavLinkProps {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}

function isRouteActive(itemHref: string, pathname: string): boolean {
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

export function NavLink({ item, pathname, collapsed, onNavigate }: NavLinkProps) {
  const active = isRouteActive(item.href, pathname);
  const disabled = !!item.comingSoon;

  const layout = collapsed ? "px-2 py-2 justify-center" : "px-3 py-2";
  const stateClasses = disabled
    ? "text-muted-foreground/40 cursor-not-allowed"
    : active
      ? "bg-accent text-accent-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground hover:bg-accent/60";

  const Icon = item.icon;

  const content = (
    <div
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md transition-all duration-150",
        layout,
        stateClasses,
      )}
    >
      {active && !disabled && !collapsed && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
      )}
      <Icon className={cn("size-4 shrink-0", active && !disabled && "text-primary")} />
      {!collapsed && (
        <>
          <span className="text-sm flex-1 truncate">{item.label}</span>
          {item.comingSoon && (
            <Badge variant="muted" className="text-[9px] px-1.5 py-0">
              soon
            </Badge>
          )}
        </>
      )}
    </div>
  );

  if (disabled) return <div>{content}</div>;

return (
  <Link
    href={item.href}
    onClick={(e) => {
      e.preventDefault();

      dispatchSidebarMainPageClick(item.href);

      onNavigate?.();

      if (pathname === item.href) {
        window.location.reload();
      } else {
        window.location.href = item.href;
      }
    }}
  >
    {content}
  </Link>
);
}
