"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 bg-card px-6 py-16 text-center">
      <div className="rounded-full bg-muted p-5">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <div className="text-[17px] font-semibold text-foreground">{title}</div>
        {description ? (
          <p className="mx-auto max-w-md text-[14px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
