"use client";

import { ThemeToggle } from "./theme-toggle";
import { HrmsUserMenu } from "./hrms-user-menu";
import { GlobalNavSearch } from "./global-nav-search";
import { HrmsNotificationsDropdown } from "./hrms-notifications-dropdown";
import { useOptionalAdminPageHeaderContext } from "@/app/components/layout/admin-page-header-context";

interface HrmsTopbarProps {
  user: any;
  onProfileOpen: () => void;
  onLogout: () => void;
}

export function HrmsTopbar({ user, onProfileOpen, onLogout }: HrmsTopbarProps) {
  const pageHeader = useOptionalAdminPageHeaderContext()?.header ?? null;

  return (
    <header className="h-16 border-b border-border/50 bg-background/75 backdrop-blur-xl sticky top-0 z-30 shrink-0">
      <div className="h-full pl-4 lg:pl-6 pr-2 lg:pr-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {pageHeader?.title ? (
            <div className="min-w-0 pr-2">
              <h1 className="truncate text-[17px] font-semibold tracking-tight text-foreground">
                {pageHeader.title}
              </h1>
              {pageHeader.subtitle ? (
                <p className="mt-0.5 truncate text-[12px] leading-snug text-muted-foreground">
                  {pageHeader.subtitle}
                </p>
              ) : null}
            </div>
          ) : (
            <GlobalNavSearch />
          )}
        </div>
        {pageHeader?.title ? <GlobalNavSearch /> : null}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <ThemeToggle />
          <HrmsNotificationsDropdown user={user} />
          <HrmsUserMenu user={user} onProfileOpen={onProfileOpen} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
