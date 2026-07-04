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
    <div className="px-4 py-14 min-h-[220px] flex flex-col items-center justify-center text-center gap-3 bg-white">
      <div className="rounded-full bg-[#F1F5F9] p-4">
        <Icon className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <div className="font-medium">{title}</div>
        {description ? (
          <p className="text-sm text-muted-foreground max-w-md">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
