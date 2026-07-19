"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { cn } from "@/app/utils/cn";
import { AnimatedNumber } from "./Sparkline";
import { MetricMicroViz, type MetricVizData } from "./MetricMicroViz";

export interface StatCardData {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  trendDelta?: string;
  sparkline?: number[];
  iconClassName?: string;
  href?: string;
  visualization?: MetricVizData;
  accentColor?: string;
}

export function StatCard({ stat }: { stat: StatCardData }) {
  const Icon = stat.icon;
  const numericValue =
    typeof stat.value === "number"
      ? stat.value
      : parseFloat(String(stat.value).replace(/[,%…—/]/g, ""));
  const canAnimate =
    !Number.isNaN(numericValue) &&
    String(stat.value) !== "—" &&
    String(stat.value) !== "…" &&
    !String(stat.value).includes("/");

  const trendUp = (stat.trend ?? 0) >= 0;
  const accent = stat.accentColor || "hsl(var(--primary))";

  const visualization: MetricVizData | undefined =
    stat.visualization ??
    (stat.sparkline && stat.sparkline.length > 1
      ? { type: "sparkline", data: stat.sparkline, color: accent }
      : undefined);

  const card = (
    <Card
      className={cn(
        "group/card overflow-hidden relative h-full min-h-[190px] border border-border/60",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]",
        "dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
        "transition-all duration-300 ease-out",
        stat.href
          ? "cursor-pointer hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.1)]"
          : "hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]",
      )}
    >
      <CardContent className="flex h-full flex-col p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary",
              stat.iconClassName,
            )}
          >
            <Icon className="size-5" strokeWidth={2} />
          </div>
          <div className="flex items-center gap-2">
            {stat.trend != null ? (
              <div
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  trendUp
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                )}
              >
                {trendUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {Math.abs(stat.trend)}%
              </div>
            ) : stat.trendDelta ? (
              <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {stat.trendDelta}
              </div>
            ) : null}
            {stat.href ? (
              <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover/card:translate-x-0.5" />
            ) : null}
          </div>
        </div>

        <div className="flex-1 space-y-0.5">
          {canAnimate ? (
            <AnimatedNumber
              value={numericValue}
              className="font-display text-[2rem] font-bold leading-none tracking-tight tabular-nums sm:text-[2.125rem]"
            />
          ) : (
            <div className="font-display text-[2rem] font-bold leading-none tracking-tight tabular-nums sm:text-[2.125rem]">
              {stat.value}
            </div>
          )}
          <p className="text-sm font-semibold text-foreground">{stat.label}</p>
          {(stat.hint || stat.unit || stat.trendLabel) && (
            <p className="text-[12px] leading-snug text-muted-foreground">
              {stat.unit || stat.trendLabel || stat.hint}
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-border/50 pt-3">
          <MetricMicroViz viz={visualization} />
        </div>
      </CardContent>
    </Card>
  );

  if (stat.href) {
    return (
      <Link
        href={stat.href}
        className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {card}
      </Link>
    );
  }

  return card;
}
