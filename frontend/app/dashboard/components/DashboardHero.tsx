"use client";

import type { ReactNode } from "react";
import { Badge } from "@/app/components/ui/badge";
import { Clock, RefreshCw } from "lucide-react";

export interface DashboardInsight {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "info";
}

interface DashboardHeroProps {
  firstName?: string;
  roleLabel?: string;
  isSuperadmin: boolean;
  lastSyncMinutesAgo?: number | null;
  insights?: DashboardInsight[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const toneClasses: Record<NonNullable<DashboardInsight["tone"]>, string> = {
  default: "bg-muted/80 text-foreground",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

export function DashboardHero({
  firstName,
  roleLabel,
  isSuperadmin,
  lastSyncMinutesAgo,
  insights = [],
}: DashboardHeroProps) {
  const greeting = getGreeting();
  const name = firstName || "there";
  const displayRole =
    roleLabel ||
    (isSuperadmin ? "Platform Administrator" : "Company Admin");

  return (
    <div className="space-y-5 pb-2">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-3">
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-1 text-[11px] font-medium tracking-wide"
          >
            {isSuperadmin ? "Superadmin · Platform" : "Workspace · HR"}
          </Badge>
          <div>
            <h1 className="font-display text-[2.25rem] sm:text-4xl font-bold tracking-tight leading-tight">
              {greeting}, {name} <span className="inline-block">👋</span>
            </h1>
            <p className="text-muted-foreground text-[15px] mt-2 max-w-2xl leading-relaxed">
              Welcome back, <span className="font-medium text-foreground">{displayRole}</span>.
              {" "}Here&apos;s what&apos;s happening in your workspace today.
            </p>
          </div>
        </div>

        {lastSyncMinutesAgo != null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <RefreshCw className="size-3.5" />
            <span>Last sync {lastSyncMinutesAgo < 1 ? "just now" : `${lastSyncMinutesAgo}m ago`}</span>
            <Clock className="size-3.5 ml-1 opacity-60" />
          </div>
        )}
      </div>

      {insights.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {insights.map((item) => (
            <div
              key={item.label}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium ${toneClasses[item.tone ?? "default"]}`}
            >
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyHint({ children }: { children?: ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground py-6 text-center">
      {children ?? "Nothing to show yet."}
    </p>
  );
}
