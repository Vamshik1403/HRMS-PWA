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
    <div
      className={cn(
        "mb-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span
              className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Icon className="size-5" />
            </span>
          ) : null}

          <div className="min-w-0">
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-foreground sm:text-[36px] lg:text-[40px]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-[15px] leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:pt-1 [&_button]:h-[46px] [&_button]:rounded-xl [&_button]:px-6">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
