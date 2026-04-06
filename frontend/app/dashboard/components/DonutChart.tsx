"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface DonutChartProps {
  value: number;
  total: number;
  label: string;
  color: string;
  bgColor: string;
}

export default function DonutChart({
  value,
  total,
  label,
  color,
  bgColor,
}: DonutChartProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const data = [
    { name: label, value: pct || 0 },
    { name: "Rest", value: 100 - (pct || 0) },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[100px] h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={34}
              outerRadius={46}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              <Cell fill={color} />
              <Cell fill={bgColor} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold leading-none" style={{ color }}>
            {pct}<span className="text-[10px] font-medium" style={{ color }}>%</span>
          </span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {value} of {total}
        </p>
      </div>
    </div>
  );
}
