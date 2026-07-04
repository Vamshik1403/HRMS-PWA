"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { cn } from "@/app/utils/cn";
import { AnimatedNumber, Sparkline } from "./Sparkline";

export interface StatCardData {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  trend?: number;
  trendLabel?: string;
  sparkline?: number[];
  iconClassName?: string;
}

export function StatCard({ stat }: { stat: StatCardData }) {
  const Icon = stat.icon;
  const numericValue =
    typeof stat.value === "number"
      ? stat.value
      : parseFloat(String(stat.value).replace(/[,%…—]/g, ""));
  const canAnimate = !Number.isNaN(numericValue) && String(stat.value) !== "—" && String(stat.value) !== "…";
  const trendUp = (stat.trend ?? 0) >= 0;

  return (
    <Card className="overflow-hidden relative group border-0 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_8px_24px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] transition-all duration-200">
      <CardContent className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div
            className={cn(
              "size-12 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0",
              stat.iconClassName,
            )}
          >
            <Icon className="size-5" strokeWidth={2} />
          </div>
          {stat.trend != null && (
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                trendUp
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              )}
            >
              {trendUp ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {Math.abs(stat.trend)}%
            </div>
          )}
        </div>

        <div className="space-y-1">
          {canAnimate ? (
            <AnimatedNumber
              value={numericValue}
              className="font-display text-[2.125rem] font-bold tracking-tight leading-none tabular-nums"
            />
          ) : (
            <div className="font-display text-[2.125rem] font-bold tracking-tight leading-none tabular-nums">
              {stat.value}
            </div>
          )}
          <p className="text-sm font-medium text-foreground">{stat.label}</p>
          {(stat.hint || stat.trendLabel) && (
            <p className="text-[13px] text-muted-foreground pt-0.5">
              {stat.trendLabel || stat.hint}
            </p>
          )}
        </div>

        {stat.sparkline && stat.sparkline.length > 1 && (
          <div className="mt-5 pt-4 border-t border-border/50">
            <Sparkline data={stat.sparkline} className="h-11 w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
