"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "../../app/page-header";
import { cn } from "@/app/utils/cn";

export function EmpDesktopPage({
  children,
  className,
  title,
  description,
  icon,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("space-y-6 w-full max-w-none animate-fade-in page-content-enter", className)}>
      {title ? (
        <PageHeader icon={icon} title={title} description={description} actions={actions} />
      ) : null}
      {children}
    </div>
  );
}
