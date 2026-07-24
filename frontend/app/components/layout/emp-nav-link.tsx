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

  const content = (
    <div
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-[38px] items-center gap-2 transition-all duration-150",
        collapsed ? "mx-1.5 justify-center rounded-[10px] px-0" : "pl-2.5 pr-2 py-2",
        active
          ? "border-l-[3px] border-[#4648d4] bg-[#eef4ff] font-bold text-[#4648d4]"
          : "border-l-[3px] border-transparent text-[#5b5f61] hover:bg-white hover:text-[#4648d4]",
      )}
    >
      <Icon
        className={cn("size-[18px] shrink-0", active ? "text-[#4648d4]" : "text-[#5b5f61]")}
        strokeWidth={1.75}
      />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">{item.label}</span>}
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
