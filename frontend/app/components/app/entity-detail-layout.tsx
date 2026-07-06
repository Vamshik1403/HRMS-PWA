"use client";

import type { ReactNode } from "react";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/utils/cn";

interface EntityDetailHeroProps {
  title: string | null | undefined;
  subtitle?: ReactNode;
  badge?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function EntityDetailHero({ title, subtitle, badge, icon, actions }: EntityDetailHeroProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4 min-w-0">
        {icon ? (
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold tracking-tight truncate">{title || "—"}</h2>
          {subtitle ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{subtitle}</div>
          ) : null}
          {badge ? (
            <Badge variant="secondary" className="mt-2 bg-emerald-50 text-emerald-700">
              {badge}
            </Badge>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

interface EntityDetailLayoutProps {
  hero?: ReactNode;
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}

export function EntityDetailLayout({ hero, children, columns = 2, className }: EntityDetailLayoutProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {hero}
      <div
        className={cn(
          "grid gap-6",
          columns === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1",
        )}
      >
        {children}
      </div>
    </div>
  );
}
