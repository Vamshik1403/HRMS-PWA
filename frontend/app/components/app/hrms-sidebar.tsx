"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/app/utils/cn";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarNavGroup } from "./sidebar-nav-group";
import { filterNavigation, buildNavContext, type NavContext } from "./hrms-navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Building2, ChevronDown } from "lucide-react";

interface HrmsSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user: any;
  navContext: NavContext;
  onRefresh?: () => void;
  accessibleCompanies?: any[];
  activeCompany?: any;
  onSwitchCompany?: (company: any) => void;
  showCompanySwitcher?: boolean;
}

export function HrmsSidebar({
  collapsed,
  onToggle,
  navContext,
  onRefresh,
  accessibleCompanies = [],
  activeCompany,
  onSwitchCompany,
  showCompanySwitcher,
}: HrmsSidebarProps) {
  const pathname = usePathname();
  const groups = filterNavigation(navContext);

  return (
    <aside
      className={cn(
        "shrink-0 border-r bg-card/40 backdrop-blur-sm transition-[width] duration-300 flex flex-col h-full min-h-0",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <SidebarBrand collapsed={collapsed} onRefresh={onRefresh} onToggle={onToggle} />

{showCompanySwitcher &&
  navContext.role === "COMPANY_ADMIN" &&
  !collapsed &&
  accessibleCompanies.length > 1 && (
    
    <div className="px-3 py-3 border-b">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full rounded-md border bg-background px-3 py-2 text-left hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {activeCompany?.companyName || "Select company"}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px]">
              {accessibleCompanies.map((company: any) => (
                <DropdownMenuItem
                  key={company.id}
                  className={cn(
                    "cursor-pointer",
                    Number(company.id) === Number(activeCompany?.id) && "bg-accent text-accent-foreground font-medium",
                  )}
                  onClick={() => onSwitchCompany?.(company)}
                >
                  {company.companyName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide py-4 px-2 space-y-6">
        {groups.map((group) => (
          <SidebarNavGroup key={group.label} group={group} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}
