"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="size-14 rounded-lg bg-muted/80 text-muted-foreground grid place-items-center mb-4">
        <Icon className="size-7" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-[13px] text-muted-foreground mt-1.5 max-w-xs leading-relaxed">{description}</p>
      {(actionLabel && actionHref) && (
        <Button asChild variant="outline" size="sm" className="mt-5">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
