"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Icon } from "@iconify/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { EmpThemeToggle } from "./EmpThemeToggle";
import { EmpPortalExpandableSearch } from "./EmpPortalExpandableSearch";
import { useEmpPortalPageContext } from "./emp-portal-page-context";
import { fetchEmpNotificationTotal } from "@/lib/empNotificationBadge";
import { getEmployeeIdFromStorage } from "@/lib/pushSubscribe";
import { cn } from "@/app/utils/cn";

function NavIconButton({
  children,
  badge,
  href,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  badge?: number;
  href?: string;
  onClick?: () => void;
  ariaLabel: string;
}) {
  const className =
    "relative inline-flex size-9 items-center justify-center rounded-full text-[#464554] transition-colors duration-150 hover:bg-[#eef4ff] hover:text-[#4648d4]";

  const content = (
    <>
      {children}
      {badge != null && badge > 0 ? (
        <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[#4648d4] text-[10px] font-semibold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function EmpPortalTopbar({
  theme,
  onToggleTheme,
  empDisplayName,
  empInitials,
  headerPhotoUrl,
  onChangePassword,
  onLogout,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  empDisplayName: string;
  empInitials: string;
  headerPhotoUrl?: string | null;
  onChangePassword: () => void;
  onLogout: () => void;
}) {
  const { header } = useEmpPortalPageContext();
  const [searchOpen, setSearchOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const PageIcon = header?.icon;

  const searchValue = header?.navbarSearch?.value ?? localSearch;
  const searchPlaceholder = header?.navbarSearch?.placeholder ?? "Search...";
  const onSearchChange = header?.navbarSearch?.onChange ?? setLocalSearch;

  useEffect(() => {
    const load = async () => {
      const employeeId = getEmployeeIdFromStorage();
      const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
      if (!employeeId || !token) return;
      try {
        const total = await fetchEmpNotificationTotal(employeeId, token);
        setNotificationCount(total);
      } catch {
        setNotificationCount(0);
      }
    };
    void load();
  }, []);

  return (
    <header className="h-[72px] shrink-0 border-b border-[#e5eeff]/60 bg-[#f8f9ff]/80 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-6 px-8">
        {header ? (
          <div className="flex min-w-0 items-center gap-3">
            {PageIcon ? (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eef4ff]">
                <PageIcon className="size-5 text-[#4648d4]" strokeWidth={1.75} />
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold leading-tight text-[#121c28]">
                {header.title}
              </h1>
              {header.subtitle ? (
                <p className="truncate text-[12px] leading-tight text-[#5b5f61]">{header.subtitle}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-[16px] font-bold text-[#121c28]">OpenHRM</div>
        )}

        <div className="flex shrink-0 items-center gap-3">
          <EmpPortalExpandableSearch
            open={searchOpen}
            onOpenChange={setSearchOpen}
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />

          <EmpThemeToggle
            theme={theme}
            onToggle={onToggleTheme}
            monochrome
            className="size-9 rounded-full border-0 bg-transparent hover:bg-[#eef4ff] hover:text-[#4648d4]"
          />

          <NavIconButton ariaLabel="Notifications" badge={notificationCount}>
            <Bell className="size-5" strokeWidth={1.75} />
          </NavIconButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full transition-opacity duration-150 hover:opacity-90 focus:outline-none"
                aria-label="Open profile menu"
              >
                <Avatar className="size-8">
                  <AvatarImage src={headerPhotoUrl ?? undefined} />
                  <AvatarFallback className="bg-[#4648d4] text-[11px] font-semibold text-white">
                    {empInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-xl border border-[#e5eeff] shadow-[0px_4px_20px_rgba(0,0,0,0.05)]"
            >
              <div className="border-b border-[#EEF2F7] px-3 py-2">
                <p className="truncate text-sm font-semibold text-[#111827]">{empDisplayName}</p>
                <p className="text-[11px] text-[#6B7280]">Employee Portal</p>
              </div>
              <DropdownMenuItem asChild>
                <Link href="/empProfile" className="cursor-pointer">
                  <Icon icon="solar:user-circle-linear" className="mr-2 size-4" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={onChangePassword}>
                <Icon icon="solar:lock-keyhole-linear" className="mr-2 size-4" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn("cursor-pointer text-red-600 focus:text-red-600")}
                onClick={onLogout}
              >
                <Icon icon="solar:logout-2-linear" className="mr-2 size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {header?.primaryAction ? (
            <Button
              type="button"
              onClick={header.primaryAction.onClick}
              className="h-10 rounded-lg bg-[#4648d4] px-[18px] text-[13px] font-medium text-white shadow-sm transition-colors duration-150 hover:bg-[#6063ee]"
            >
              {header.primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
