"use client";

import { cn } from "@/app/utils/cn";
import { Sparkline } from "./Sparkline";

export type MetricBarItem = {
  label: string;
  value: number;
  color?: string;
};

export type MetricSegment = {
  label: string;
  value: number;
  color: string;
};

export type MetricTimelineItem = {
  label: string;
  sub?: string;
};

export type MetricVizData =
  | { type: "sparkline"; data: number[]; color?: string }
  | { type: "bars"; items: MetricBarItem[]; maxItems?: number }
  | { type: "stacked"; segments: MetricSegment[] }
  | { type: "donut"; segments: MetricSegment[] }
  | { type: "progress"; segments: MetricSegment[] }
  | { type: "timeline"; items: MetricTimelineItem[] }
  | { type: "calendar"; items: { label: string; date?: string }[] }
  | { type: "funnel"; items: MetricBarItem[] }
  | { type: "ring"; value: number; max?: number; color?: string }
  | { type: "avatar-stack"; avatars: { initial: string; color?: string }[] };

const BAR_COLORS = ["#2563eb", "#7c3aed", "#14b8a6", "#f59e0b", "#f43f5e", "#6366f1"];

function vizHeight(type: MetricVizData["type"]) {
  if (type === "sparkline") return "h-12";
  if (type === "donut" || type === "ring") return "h-14";
  if (type === "timeline" || type === "calendar") return "min-h-[52px]";
  return "h-[52px]";
}

export function MetricMicroViz({
  viz,
  className,
}: {
  viz?: MetricVizData;
  className?: string;
}) {
  if (!viz) {
    return (
      <div className={cn("h-12 rounded-lg bg-muted/30 border border-dashed border-border/60", className)} />
    );
  }

  return (
    <div className={cn("w-full overflow-hidden", vizHeight(viz.type), className)}>
      {viz.type === "sparkline" && <SparklineViz data={viz.data} color={viz.color} />}
      {viz.type === "bars" && <HorizontalBars items={viz.items} maxItems={viz.maxItems} />}
      {viz.type === "stacked" && <StackedBar segments={viz.segments} />}
      {viz.type === "donut" && <MiniDonut segments={viz.segments} />}
      {viz.type === "progress" && <ProgressBars segments={viz.segments} />}
      {viz.type === "timeline" && <MiniTimeline items={viz.items} />}
      {viz.type === "calendar" && <CalendarStrip items={viz.items} />}
      {viz.type === "funnel" && <MiniFunnel items={viz.items} />}
      {viz.type === "ring" && (
        <ProgressRing value={viz.value} max={viz.max} color={viz.color} />
      )}
      {viz.type === "avatar-stack" && <AvatarStack avatars={viz.avatars} />}
    </div>
  );
}

function SparklineViz({ data, color }: { data: number[]; color?: string }) {
  if (!data.length) return <EmptyViz />;
  if (data.length === 1) {
    return (
      <div className="flex h-full items-end gap-1 px-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-primary/20"
            style={{ height: i === 6 ? `${Math.max(20, data[0] * 8)}%` : "12%" }}
          />
        ))}
      </div>
    );
  }
  return <Sparkline data={data} color={color} className="h-full w-full" height={48} />;
}

function HorizontalBars({ items, maxItems = 4 }: { items: MetricBarItem[]; maxItems?: number }) {
  const rows = items.filter((i) => i.value > 0).slice(0, maxItems);
  if (!rows.length) return <EmptyViz />;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      {rows.map((row, i) => (
        <div key={row.label} className="flex items-center gap-2 text-[10px]">
          <span className="w-14 shrink-0 truncate text-muted-foreground">{row.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(row.value / max) * 100}%`,
                backgroundColor: row.color || BAR_COLORS[i % BAR_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StackedBar({ segments }: { segments: MetricSegment[] }) {
  const active = segments.filter((s) => s.value > 0);
  const total = active.reduce((sum, s) => sum + s.value, 0);
  if (!total) return <EmptyViz />;

  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/50">
        {active.map((seg) => (
          <div
            key={seg.label}
            className="h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {active.slice(0, 4).map((seg) => (
          <span key={seg.label} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniDonut({ segments }: { segments: MetricSegment[] }) {
  const active = segments.filter((s) => s.value > 0);
  const total = active.reduce((sum, s) => sum + s.value, 0);
  if (!total) return <EmptyViz />;

  let offset = 0;
  const stops = active.map((seg) => {
    const pct = (seg.value / total) * 100;
    const start = offset;
    offset += pct;
    return `${seg.color} ${start}% ${offset}%`;
  });

  return (
    <div className="flex h-full items-center gap-3">
      <div
        className="size-12 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="m-[5px] flex size-[calc(100%-10px)] items-center justify-center rounded-full bg-card text-[10px] font-bold tabular-nums">
          {total}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {active.slice(0, 3).map((seg) => (
          <div key={seg.label} className="flex items-center justify-between gap-2 text-[10px]">
            <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="truncate">{seg.label}</span>
            </span>
            <span className="font-semibold tabular-nums">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBars({ segments }: { segments: MetricSegment[] }) {
  const active = segments.filter((s) => s.value >= 0);
  const max = Math.max(...active.map((s) => s.value), 1);
  if (!active.length) return <EmptyViz />;

  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      {active.slice(0, 3).map((seg) => (
        <div key={seg.label} className="flex items-center gap-2 text-[10px]">
          <span className="w-12 shrink-0 truncate text-muted-foreground">{seg.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(seg.value / max) * 100}%`, backgroundColor: seg.color }}
            />
          </div>
          <span className="w-4 shrink-0 text-right font-semibold tabular-nums">{seg.value}</span>
        </div>
      ))}
    </div>
  );
}

function MiniTimeline({ items }: { items: MetricTimelineItem[] }) {
  if (!items.length) return <EmptyViz />;
  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      {items.slice(0, 3).map((item, i) => (
        <div key={`${item.label}-${i}`} className="flex items-start gap-2 text-[10px]">
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{item.label}</p>
            {item.sub ? <p className="truncate text-muted-foreground">{item.sub}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarStrip({ items }: { items: { label: string; date?: string }[] }) {
  if (!items.length) return <EmptyViz />;
  return (
    <div className="flex h-full items-center gap-2 overflow-x-auto scrollbar-none">
      {items.slice(0, 4).map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className={cn(
            "flex min-w-[56px] shrink-0 flex-col items-center rounded-lg border px-2 py-1.5 text-center",
            i === 0 ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20",
          )}
        >
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.date || "—"}
          </span>
          <span className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-tight text-foreground">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniFunnel({ items }: { items: MetricBarItem[] }) {
  const rows = items.filter((i) => i.value > 0).slice(0, 4);
  if (!rows.length) return <EmptyViz />;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-1">
      {rows.map((row, i) => (
        <div key={row.label} className="flex items-center gap-2">
          <div
            className="h-2 rounded-sm transition-all duration-700"
            style={{
              width: `${Math.max(18, (row.value / max) * 100)}%`,
              backgroundColor: row.color || BAR_COLORS[i % BAR_COLORS.length],
              opacity: 1 - i * 0.12,
            }}
          />
          <span className="text-[9px] text-muted-foreground">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressRing({
  value,
  max = 100,
  color = "#2563eb",
}: {
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex h-full items-center gap-3">
      <div
        className="relative size-12 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${color} ${pct}%, hsl(var(--muted)) ${pct}% 100%)`,
        }}
      >
        <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-card text-[10px] font-bold tabular-nums">
          {Math.round(pct)}%
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground">
        <span className="block font-semibold text-foreground">{value}</span>
        of {max} target
      </div>
    </div>
  );
}

function AvatarStack({ avatars }: { avatars: { initial: string; color?: string }[] }) {
  if (!avatars.length) return <EmptyViz />;
  const colors = ["#2563eb", "#7c3aed", "#14b8a6", "#f59e0b", "#f43f5e"];
  return (
    <div className="flex h-full items-center">
      <div className="flex -space-x-2">
        {avatars.slice(0, 5).map((a, i) => (
          <div
            key={`${a.initial}-${i}`}
            className="flex size-8 items-center justify-center rounded-full border-2 border-card text-[10px] font-bold text-white"
            style={{ backgroundColor: a.color || colors[i % colors.length] }}
          >
            {a.initial}
          </div>
        ))}
      </div>
      {avatars.length > 5 ? (
        <span className="ml-2 text-[10px] font-medium text-muted-foreground">+{avatars.length - 5}</span>
      ) : null}
    </div>
  );
}

function EmptyViz() {
  return (
    <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
      No trend data yet
    </div>
  );
}

export function buildSparklineFromValues(values: number[]): number[] {
  return values.length ? values : [0];
}

export function groupCountByField<T>(
  items: T[],
  field: (item: T) => string | null | undefined,
  limit = 4,
): MetricBarItem[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = field(item)?.trim() || "Other";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}
