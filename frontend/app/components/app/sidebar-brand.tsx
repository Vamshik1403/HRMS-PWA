"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, RefreshCw } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { Button } from "@/app/components/ui/button";

interface SidebarBrandProps {
  collapsed: boolean;
  homeHref?: string;
  onRefresh?: () => void;
  onToggle?: () => void;
}

export function SidebarBrand({ collapsed, homeHref = "/dashboard", onRefresh, onToggle }: SidebarBrandProps) {
  if (collapsed) {
    return (
      <div className="border-b shrink-0 px-2 py-3 flex flex-col items-center gap-2">
        <Link
          href={homeHref}
          className="flex items-center justify-center w-full"
          title="OpenHRM"
        >
          <img
            src="/img/OpenHRM_Logo.png"
            alt="OpenHRM"
            className="size-9 rounded-md object-cover shadow-sm shrink-0"
          />
        </Link>
        {onToggle && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="size-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-16 px-3 flex items-center gap-1 border-b shrink-0 min-w-0">
      <Link href={homeHref} className="flex items-center gap-2 min-w-0 flex-1">
        <img
          src="/img/OpenHRM_Logo.png"
          alt="OpenHRM"
          className="size-9 rounded-md object-cover shadow-sm shrink-0"
        />
        <div className="min-w-0">
          <div className="font-display text-base font-semibold tracking-tight leading-none truncate">
            OpenHRM
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-mono">
            v1.0.0
          </div>
        </div>
      </Link>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="p-1.5 mr-0.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent/60 transition-colors shrink-0"
          title="Refresh data"
        >
          <RefreshCw className="size-4" />
        </button>
      )}

      {onToggle && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="size-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="size-4" />
        </Button>
      )}
    </div>
  );
}
