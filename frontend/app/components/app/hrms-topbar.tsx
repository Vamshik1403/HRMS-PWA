"use client";

import { Bell, HelpCircle, MessageSquare } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { HrmsUserMenu } from "./hrms-user-menu";
import { GlobalNavSearch } from "./global-nav-search";

interface HrmsTopbarProps {
  user: any;
  onProfileOpen: () => void;
  onLogout: () => void;
}

function NotificationsBell() {
  return (
    <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" disabled>
      <Bell className="size-4" />
      <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary ring-2 ring-background" />
    </Button>
  );
}

export function HrmsTopbar({ user, onProfileOpen, onLogout }: HrmsTopbarProps) {
  return (
    <header className="h-16 border-b border-border/50 bg-background/75 backdrop-blur-xl sticky top-0 z-30 shrink-0">
      <div className="h-full pl-4 lg:pl-6 pr-2 lg:pr-4 flex items-center gap-3">
        <GlobalNavSearch />
        <div className="flex-1 sm:hidden" />
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Messages" disabled>
            <MessageSquare className="size-4" />
          </Button>
          <NotificationsBell />
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Help" disabled>
            <HelpCircle className="size-4" />
          </Button>
          <HrmsUserMenu user={user} onProfileOpen={onProfileOpen} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
