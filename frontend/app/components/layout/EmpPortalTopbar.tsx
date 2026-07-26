"use client";

import Link from "next/link";
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
import { EmpPortalNotificationsDropdown } from "./EmpPortalNotificationsDropdown";
import { useEmpPortalPageContext } from "./emp-portal-page-context";
import { cn } from "@/app/utils/cn";
import { useState } from "react";

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
  const searchValue = header?.navbarSearch?.value ?? localSearch;
  const searchPlaceholder = header?.navbarSearch?.placeholder ?? "Search...";
  const onSearchChange = header?.navbarSearch?.onChange ?? setLocalSearch;

  return (
    <header className="h-[72px] shrink-0 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-6 px-8">
        {header ? (
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-foreground">
              {header.title}
            </h1>
            {header.subtitle ? (
              <p className="mt-0.5 truncate text-[12px] leading-snug text-muted-foreground">{header.subtitle}</p>
            ) : null}
          </div>
        ) : (
          <div className="text-[16px] font-bold text-foreground">OpenHRM</div>
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
            className="size-9 rounded-full border-0 bg-transparent hover:bg-muted hover:text-foreground"
          />

          <EmpPortalNotificationsDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full transition-opacity duration-150 hover:opacity-90 focus:outline-none"
                aria-label="Open profile menu"
              >
                <Avatar className="size-8">
                  <AvatarImage src={headerPhotoUrl ?? undefined} />
                  <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
                    {empInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-xl border border-border bg-popover text-popover-foreground shadow-md"
            >
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-sm font-semibold text-foreground">{empDisplayName}</p>
                <p className="text-[11px] text-muted-foreground">Employee Portal</p>
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
                className={cn("cursor-pointer text-destructive focus:text-destructive")}
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
              className="h-10 rounded-lg px-[18px] text-[13px] font-medium shadow-sm"
            >
              {header.primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
