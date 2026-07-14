"use client";

import { memo, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SAAS } from "./super-dashboard-ui";

export const StaticSparkline = memo(function StaticSparkline({
  data,
  color = SAAS.blue,
  width = 72,
  height = 28,
  className,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const points = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    return data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - 4 - ((v - min) / range) * (height - 8);
        return `${x},${y}`;
      })
      .join(" ");
  }, [data, width, height]);

  if (data.length < 2) return null;

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      focusable="false"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
});

export const RadialGauge = memo(function RadialGauge({
  label,
  value,
  usedLabel,
  color = SAAS.blue,
}: {
  label: string;
  value: number;
  usedLabel?: string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const data = [
    { name: "used", value: pct },
    { name: "free", value: 100 - pct },
  ];

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative size-[108px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={50}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
              isAnimationActive={false}
            >
              <Cell fill={color} />
              <Cell fill="#E2E8F0" className="dark:fill-muted" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums text-[#0F172A] dark:text-foreground">{pct}%</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-[#0F172A] dark:text-foreground">{label}</p>
      {usedLabel ? <p className="text-[11px] text-[#64748B] dark:text-muted-foreground">{usedLabel}</p> : null}
    </div>
  );
});

export const EnterpriseLineChart = memo(function EnterpriseLineChart({
  data,
  lines,
  height = 260,
  yFormatter,
}: {
  data: Record<string, string | number>[];
  lines: { key: string; label: string; color: string }[];
  height?: number;
  yFormatter?: (v: number) => string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const theme = useMemo(
    () => ({
      grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
      tick: isDark ? "#a1a1aa" : SAAS.muted,
      tooltipBg: isDark ? "#18181b" : "#ffffff",
      tooltipBorder: isDark ? "#3f3f46" : SAAS.border,
      tooltipText: isDark ? "#fafafa" : SAAS.text,
    }),
    [isDark],
  );

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC]/60 text-sm text-[#64748B] dark:border-border dark:bg-muted/20 dark:text-muted-foreground"
        style={{ height }}
      >
        Collecting live metrics…
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: theme.tick }}
            minTickGap={28}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: theme.tick }}
            width={36}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${theme.tooltipBorder}`,
              backgroundColor: theme.tooltipBg,
              color: theme.tooltipText,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              yFormatter ? yFormatter(value) : value,
              lines.find((l) => l.key === name)?.label ?? name,
            ]}
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.key}
              stroke={line.color}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export const EnterpriseAreaChart = memo(function EnterpriseAreaChart({
  data,
  lines,
  height = 220,
  yFormatter,
}: {
  data: Record<string, string | number>[];
  lines: { key: string; label: string; color: string }[];
  height?: number;
  yFormatter?: (v: number) => string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC]/60 text-sm text-[#64748B] dark:border-border dark:bg-muted/20 dark:text-muted-foreground"
        style={{ height }}
      >
        Collecting live metrics…
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            {lines.map((line) => (
              <linearGradient key={line.key} id={`grad-${line.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={line.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={line.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"} vertical={false} />
          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : SAAS.muted }} minTickGap={28} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : SAAS.muted }} width={40} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${isDark ? "#3f3f46" : SAAS.border}`,
              backgroundColor: isDark ? "#18181b" : "#fff",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              yFormatter ? yFormatter(value) : value,
              lines.find((l) => l.key === name)?.label ?? name,
            ]}
          />
          {lines.map((line) => (
            <Area
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.key}
              stroke={line.color}
              strokeWidth={2}
              fill={`url(#grad-${line.key})`}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export const SecurityDonut = memo(function SecurityDonut({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 85 ? SAAS.green : pct >= 60 ? SAAS.amber : SAAS.red;
  const data = [
    { name: "score", value: pct },
    { name: "gap", value: 100 - pct },
  ];

  return (
    <div className="relative mx-auto size-[168px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={78}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={0}
            isAnimationActive={false}
          >
            <Cell fill={color} />
            <Cell fill="#E2E8F0" className="dark:fill-muted" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>
          {pct}
        </span>
        <span className="text-xs font-medium text-[#64748B] dark:text-muted-foreground">Security Score</span>
      </div>
    </div>
  );
});

export function MiniSpark({
  data,
  color = SAAS.blue,
  className,
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  return (
    <div className={className ?? "shrink-0"}>
      <StaticSparkline data={data} color={color} width={64} height={28} />
    </div>
  );
}

export function CapacityBar({
  label,
  used,
  total,
}: {
  label: string;
  used: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const tone = pct >= 85 ? SAAS.red : pct >= 70 ? SAAS.amber : SAAS.blue;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[#0F172A] dark:text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-[#64748B] dark:text-muted-foreground">
          {pct}% · {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: tone }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-[#64748B] dark:text-muted-foreground">
        <span>Used {formatBytes(used)}</span>
        <span>Free {formatBytes(Math.max(0, total - used))}</span>
      </div>
    </div>
  );
}

export function formatBytes(bytes?: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function formatRate(bytesPerSec?: number) {
  if (!bytesPerSec) return "0 B/s";
  return `${formatBytes(bytesPerSec)}/s`;
}
