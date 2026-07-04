"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/app/utils/cn";

export interface QuickActionItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  iconClassName?: string;
}

export function QuickActionCard({ action }: { action: QuickActionItem }) {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      className="group flex items-start gap-4 rounded-lg border-0 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.1)] transition-all duration-150"
    >
      <div
        className={cn(
          "size-11 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-150",
          action.iconClassName,
        )}
      >
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-foreground leading-snug">{action.label}</p>
        {action.description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.description}</p>
        )}
      </div>
      <ArrowRight className="size-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shrink-0 mt-1" />
    </Link>
  );
}

export function QuickActionIcon({ action }: { action: QuickActionItem }) {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      title={action.label}
      aria-label={action.label}
      className={cn(
        "group flex items-center justify-center size-10 rounded-md bg-muted/60 text-primary",
        "hover:bg-primary hover:text-primary-foreground hover:-translate-y-0.5 hover:shadow-md transition-all duration-150",
        action.iconClassName,
      )}
    >
      <Icon className="size-[18px]" strokeWidth={2} />
    </Link>
  );
}

export function QuickActionGrid({
  actions,
  iconOnly = false,
}: {
  actions: QuickActionItem[];
  iconOnly?: boolean;
}) {
  if (iconOnly) {
    return (
      <div className="grid grid-cols-5 gap-2">
        {actions.map((action) => (
          <QuickActionIcon key={action.href} action={action} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {actions.map((action) => (
        <QuickActionCard key={action.href} action={action} />
      ))}
    </div>
  );
}
