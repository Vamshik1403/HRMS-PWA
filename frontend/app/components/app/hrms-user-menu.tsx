"use client";

import { forwardRef } from "react";
import { LogOut, Settings2, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "SUPERADMIN",
  SERVICE_PROVIDER: "SERVICE_PROVIDER",
  COMPANY_ADMIN: "COMPANY_ADMIN",
  ADMIN: "ADMIN",
  BRANCH_ADMIN: "BRANCH_ADMIN",
  EMPLOYEE: "EMPLOYEE",
};

function getInitials(user: any): string {
  const first = user?.firstName?.[0] ?? user?.username?.[0] ?? "";
  const last = user?.lastName?.[0] ?? user?.username?.[1] ?? "";
  return (first + last).toUpperCase() || "?";
}

function getDisplayName(user: any): string {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return full || user?.username || "User";
}

interface HrmsUserMenuProps {
  user: any;
  onProfileOpen: () => void;
  onLogout: () => void;
}

const UserMenuTriggerButton = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button> & { user: any }
>(function UserMenuTriggerButton({ user, ...rest }, ref) {
  return (
    <Button ref={ref} variant="ghost" className="gap-2 px-2 h-10" {...rest}>
      <Avatar className="size-8">
        <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(user)}</AvatarFallback>
      </Avatar>
      <div className="hidden md:flex flex-col items-start leading-tight">
        <span className="text-sm font-medium truncate max-w-[140px]">{getDisplayName(user)}</span>
        <span className="text-[11px] text-muted-foreground uppercase">{ROLE_LABELS[user?.role] || user?.role}</span>
      </div>
    </Button>
  );
});

export function HrmsUserMenu({ user, onProfileOpen, onLogout }: HrmsUserMenuProps) {
  const isSuperadmin = user?.role === "SUPERADMIN";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <UserMenuTriggerButton user={user} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
        <div className="px-2.5 pb-2 space-y-1">
          <div className="text-sm font-semibold truncate">{getDisplayName(user)}</div>
          <div className="text-xs text-muted-foreground truncate">{user?.username}</div>
          <div className="flex flex-wrap gap-1 pt-2">
            {user?.role && (
              <Badge variant="default" className="text-[10px]">{ROLE_LABELS[user.role] || user.role}</Badge>
            )}
            {isSuperadmin ? (
              <Badge variant="warning" className="text-[10px]">superadmin</Badge>
            ) : user?.companyID ? (
              <Badge variant="secondary" className="text-[10px]">tenant</Badge>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={onProfileOpen}>
          <User className="size-4 mr-2" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={onProfileOpen}>
          <Settings2 className="size-4 mr-2" /> Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={onLogout}>
          <LogOut className="size-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
