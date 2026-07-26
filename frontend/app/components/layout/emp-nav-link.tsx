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
  badgeCount?: number;
}

export function EmpNavLink({ item, pathname, collapsed, badgeCount = 0 }: EmpNavLinkProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = isEmpNavItemActive(item, pathname, searchParams);
  const Icon = item.icon;
  const showBadge = badgeCount > 0;

  const content = (
    <div
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-[38px] items-center gap-2 transition-all duration-150",
        collapsed ? "mx-1.5 justify-center rounded-[10px] px-0" : "pl-2.5 pr-2 py-2",
        active
          ? "border-l-[3px] border-primary bg-primary/10 font-bold text-primary"
          : "border-l-[3px] border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="relative shrink-0">
        <Icon
          className={cn("size-[18px]", active ? "text-primary" : "text-muted-foreground")}
          strokeWidth={1.75}
        />
        {collapsed && showBadge ? (
          <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </span>
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">{item.label}</span>
          {showBadge ? (
            <span className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );

  return (
    <Link
      href={item.href}
      onClick={(e) => {
        if (active) {
          e.preventDefault();
          router.refresh();
        }
      }}
    >
      {content}
    </Link>
  );
}
