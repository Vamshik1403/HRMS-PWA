"use client";

import { useEffect, useRef } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: number[];
  color?: string;
  className?: string;
  height?: number;
}

export function Sparkline({
  data,
  color = "hsl(217, 91%, 60%)",
  className = "h-10 w-full",
  height = 40,
}: SparklineProps) {
  const chartData = data.map((value, i) => ({ i, value }));
  if (chartData.length < 2) return null;

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#sparkFill)"
            isAnimationActive
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AnimatedNumber({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const numeric = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));

  useEffect(() => {
    if (!ref.current || Number.isNaN(numeric)) return;
    const el = ref.current;
    const start = 0;
    const end = numeric;
    const duration = 600;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(start + (end - start) * eased);
      el.textContent = current.toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [numeric]);

  if (Number.isNaN(numeric)) {
    return <span className={className}>{value}</span>;
  }

  return <span ref={ref} className={className}>0</span>;
}
