"use client";

import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/app/utils/cn";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4 flex-wrap", className)}>
      <div className="min-w-0">
        {Icon && (
          <div
            className="mb-2.5 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </div>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
