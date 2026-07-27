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
      <div className="flex h-[72px] shrink-0 flex-col items-center justify-center gap-2 border-b border-border px-2">
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
      <div className="flex h-[72px] shrink-0 items-center gap-1 border-b border-border px-2.5 min-w-0">
      <Link href={homeHref} className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <img
          src="/img/OpenHRM_Logo.png"
          alt="OpenHRM"
          className="size-8 rounded-md object-cover shadow-sm shrink-0"
        />
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold tracking-tight leading-none whitespace-nowrap">
            OpenHRM
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider font-mono">
            v1.0.0
          </div>
        </div>
      </Link>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-accent/60 transition-colors shrink-0"
          title="Refresh data"
        >
          <RefreshCw className="size-3.5" />
        </button>
      )}

      {onToggle && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
