"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import { Button } from "@/app/components/ui/button";

type NoticeVariant = "warning" | "error" | "info" | "success";

const variantStyles: Record<
  NoticeVariant,
  { shell: string; iconTile: string; Icon: LucideIcon }
> = {
  warning: {
    shell:
      "bg-amber-500/[0.08] ring-1 ring-amber-500/20 dark:bg-amber-500/10 dark:ring-amber-500/25",
    iconTile: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  error: {
    shell:
      "bg-destructive/[0.06] ring-1 ring-destructive/20 dark:bg-destructive/10 dark:ring-destructive/25",
    iconTile: "bg-destructive/10 text-destructive",
    Icon: AlertCircle,
  },
  info: {
    shell:
      "bg-primary/[0.06] ring-1 ring-primary/15 dark:bg-primary/10 dark:ring-primary/20",
    iconTile: "bg-primary/10 text-primary",
    Icon: Info,
  },
  success: {
    shell:
      "bg-emerald-500/[0.08] ring-1 ring-emerald-500/20 dark:bg-emerald-500/10 dark:ring-emerald-500/25",
    iconTile: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
};

export interface NoticeBannerProps {
  variant?: NoticeVariant;
  title?: string;
  description?: string;
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  className?: string;
  /** Single-line layout for inline status messages */
  compact?: boolean;
  /** Centered layout for empty-state style notices */
  centered?: boolean;
}

export function NoticeBanner({
  variant = "warning",
  title,
  description,
  children,
  actionLabel,
  onAction,
  actionIcon: ActionIcon = RefreshCw,
  className,
  compact = false,
  centered = false,
}: NoticeBannerProps) {
  const { shell, iconTile, Icon } = variantStyles[variant];
  const message = children ?? description;

  if (centered) {
    return (
      <section
        role="alert"
        className={cn(
          "rounded-lg p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          shell,
          className,
        )}
      >
        <div className={cn("size-12 rounded-lg mx-auto mb-4 grid place-items-center", iconTile)}>
          <Icon className="size-6" strokeWidth={2} />
        </div>
        {title && (
          <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
        )}
        {(description || (children && !description)) && (
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            {description ?? message}
          </p>
        )}
        {children && description && <div className="mt-4">{children}</div>}
        {actionLabel && onAction && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAction}
            className="mt-5 rounded-md h-8 px-3.5 text-xs font-semibold bg-background/80 hover:bg-background"
          >
            <ActionIcon className="size-3.5" />
            {actionLabel}
          </Button>
        )}
      </section>
    );
  }

  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          shell,
          className,
        )}
      >
        <div className={cn("size-8 rounded-lg grid place-items-center shrink-0", iconTile)}>
          <Icon className="size-4" strokeWidth={2} />
        </div>
        <p className="flex-1 min-w-0 text-sm text-foreground leading-snug">{message}</p>
        {actionLabel && onAction && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAction}
            className="shrink-0 rounded-md h-8 px-3.5 text-xs font-semibold bg-background/80 hover:bg-background"
          >
            <ActionIcon className="size-3.5" />
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <section
      role="alert"
      className={cn(
        "rounded-lg p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        shell,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("size-10 rounded-md grid place-items-center shrink-0", iconTile)}>
          <Icon className="size-5" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
          )}
          {description && (
            <p className={cn("text-[13px] text-muted-foreground leading-relaxed", title && "mt-1")}>
              {description}
            </p>
          )}
          {children && !description && (
            <div className={cn("text-[13px] text-foreground", title && "mt-1")}>{children}</div>
          )}
          {children && description && <div className="mt-3">{children}</div>}
        </div>
        {actionLabel && onAction && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAction}
            className="shrink-0 rounded-md h-8 px-3.5 text-xs font-semibold bg-background/80 hover:bg-background"
          >
            <ActionIcon className="size-3.5" />
            {actionLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
