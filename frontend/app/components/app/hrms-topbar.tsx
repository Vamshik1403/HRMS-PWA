"use client";

import { ThemeToggle } from "./theme-toggle";
import { HrmsUserMenu } from "./hrms-user-menu";
import { GlobalNavSearch } from "./global-nav-search";
import { HrmsNotificationsDropdown } from "./hrms-notifications-dropdown";

interface HrmsTopbarProps {
  user: any;
  onProfileOpen: () => void;
  onLogout: () => void;
}

export function HrmsTopbar({ user, onProfileOpen, onLogout }: HrmsTopbarProps) {
  return (
    <header className="h-16 border-b border-border/50 bg-background/75 backdrop-blur-xl sticky top-0 z-30 shrink-0">
      <div className="h-full pl-4 lg:pl-6 pr-2 lg:pr-4 flex items-center gap-3">
        <GlobalNavSearch />
        <div className="flex-1 sm:hidden" />
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <ThemeToggle />
          <HrmsNotificationsDropdown />
          <HrmsUserMenu user={user} onProfileOpen={onProfileOpen} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
