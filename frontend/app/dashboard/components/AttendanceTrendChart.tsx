"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { SoftBarPoint } from "./SoftBarChart";

interface AttendanceTrendChartProps {
  data: SoftBarPoint[];
  className?: string;
}

export function AttendanceTrendChart({ data, className = "h-[240px]" }: AttendanceTrendChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const theme = useMemo(
    () => ({
      stroke: isDark ? "hsl(217, 91%, 65%)" : "hsl(217, 91%, 60%)",
      grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      tick: isDark ? "#a1a1aa" : "#6b7280",
      tooltipBg: isDark ? "#18181b" : "#ffffff",
      tooltipBorder: isDark ? "#3f3f46" : "#e5e7eb",
      tooltipText: isDark ? "#fafafa" : "#111827",
    }),
    [isDark],
  );

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: theme.tick, fontWeight: 500 }}
          />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${theme.tooltipBorder}`,
              backgroundColor: theme.tooltipBg,
              color: theme.tooltipText,
              fontSize: 12,
              fontWeight: 600,
            }}
            formatter={(value: number) => [value, "Present"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={theme.stroke}
            strokeWidth={2.5}
            dot={{ r: 3, fill: theme.stroke, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: theme.stroke }}
            isAnimationActive
            animationDuration={900}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
