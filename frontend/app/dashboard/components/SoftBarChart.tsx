"use client";

import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface SoftBarPoint {
  day: string;
  value: number;
}

interface SoftBarChartProps {
  data: SoftBarPoint[];
  highlightColor?: string;
  barColor?: string;
}

export default function SoftBarChart({
  data,
  highlightColor = "#22c55e",
  barColor = "#e8e8e8",
}: SoftBarChartProps) {
  const maxVal = Math.max(0, ...data.map((d) => d.value));
  const maxIndex = data.findIndex((d) => d.value === maxVal && maxVal > 0);

  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="28%" margin={{ top: 28, right: 8, left: -8, bottom: 0 }}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#9ca3af", fontWeight: 500 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.02)" }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid #ececec",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 14px",
              background: "#fff",
            }}
            formatter={(value: number) => [value.toLocaleString(), "Present"]}
          />
          <Bar dataKey="value" radius={[10, 10, 10, 10]} maxBarSize={36}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === maxIndex && maxVal > 0 ? highlightColor : barColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
