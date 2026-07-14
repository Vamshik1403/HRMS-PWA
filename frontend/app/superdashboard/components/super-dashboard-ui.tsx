"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/app/utils/cn";

export const SAAS = {
  blue: "#2563EB",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
  purple: "#8B5CF6",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#0F172A",
  muted: "#64748B",
} as const;

export const panelCard =
  "rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] dark:border-border dark:bg-card dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]";

/** Improves scroll performance for off-screen dashboard sections */
export const lazySection = "[content-visibility:auto] [contain-intrinsic-size:1px_520px]";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn(panelCard, "p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-[#0F172A] dark:text-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-xs text-[#64748B] dark:text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function StatusPill({
  label,
  tone = "ok",
}: {
  label: string;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "bg-red-500/10 text-red-700 dark:text-red-300"
          : "bg-slate-500/10 text-slate-600 dark:text-slate-300";

  return (
    <span className={cn("inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

export function IconBubble({
  icon: Icon,
  color = SAAS.blue,
  className,
}: {
  icon: LucideIcon;
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid size-11 shrink-0 place-items-center rounded-xl", className)}
      style={{ backgroundColor: `${color}14`, color }}
    >
      <Icon className="size-5" strokeWidth={2} />
    </div>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-200">
      <span className="size-2 rounded-full bg-emerald-500" />
      {children}
    </div>
  );
}
