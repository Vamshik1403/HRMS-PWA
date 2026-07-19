"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type SegmentDatum = {
  name: string;
  value: number;
  color: string;
};

export function EmpSegmentDonut({
  data,
  height = 220,
  centerLabel,
}: {
  data: SegmentDatum[];
  height?: number;
  centerLabel?: string;
}) {
  const segments = data.filter((d) => d.value > 0);
  const total = segments.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No data to chart yet
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      <div className="relative w-full max-w-[220px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {segments.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{total}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</span>
          </div>
        ) : null}
      </div>
      <ul className="flex-1 w-full space-y-2">
        {segments.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate text-foreground">{item.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-muted-foreground">
              {Math.round((item.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function attendanceDaysToHoursChart(
  days: { dateKey: string; workSeconds: number; checkIn?: string | null }[],
) {
  return [...days].reverse().map((d) => ({
    day: new Date(d.dateKey + "T12:00:00Z").toLocaleDateString("en-IN", {
      weekday: "short",
      timeZone: "UTC",
    }),
    value: Math.round((d.workSeconds / 3600) * 10) / 10,
  }));
}

export function attendanceDaysToPresenceChart(
  days: { dateKey: string; checkIn?: string | null; checkOut?: string | null }[],
) {
  return [...days].reverse().map((d) => ({
    day: new Date(d.dateKey + "T12:00:00Z").toLocaleDateString("en-IN", {
      weekday: "short",
      timeZone: "UTC",
    }),
    value: d.checkIn && d.checkOut ? 1 : d.checkIn ? 0.5 : 0,
  }));
}
