"use client";

import Link from "next/link";
import { cn } from "@/app/utils/cn";

export interface ActivityItem {
  id: string;
  headline: string;
  body?: string;
  time: string;
  avatarInitial: string;
  avatarBg?: string;
  href?: string;
}

export function ActivityFeed({
  items,
  emptyTitle = "No recent activity",
  emptyDescription = "Activity from check-ins, leave, and updates will appear here.",
  fillHeight = false,
}: {
  items: ActivityItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  fillHeight?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "text-center",
          fillHeight ? "flex-1 flex flex-col items-center justify-center py-6" : "py-8",
        )}
      >
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-1", fillHeight && "flex-1 overflow-y-auto min-h-0")}>
      {items.map((item) => {
        const content = (
          <div className="flex gap-3 rounded-xl px-3 py-3 hover:bg-muted/50 transition-colors duration-150">
            <div
              className={cn(
                "size-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0",
                item.avatarBg ?? "bg-primary",
              )}
            >
              {item.avatarInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground leading-snug">{item.headline}</p>
              {item.body && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{item.body}</p>
              )}
              <p className="text-[11px] text-muted-foreground/80 mt-1.5">{item.time}</p>
            </div>
          </div>
        );

        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className="block">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
