"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

export type StatusBreakdownItem = {
  name: string;
  value: number;
  fill: string;
};

interface EmployeeStatusChartsProps {
  total: number;
  present: number;
  absent: number;
  statusBreakdown?: StatusBreakdownItem[];
}

const DEFAULT_COLORS: Record<string, string> = {
  Present: "#22c55e",
  "Late Mark": "#f59e0b",
  "Half Day": "#a855f7",
  Absent: "#fb7185",
  "No checkout": "#6366f1",
  Leave: "#ec4899",
  "Week Off": "#94a3b8",
  Holiday: "#0ea5e9",
  OT: "#14b8a6",
  Regularized: "#8b5cf6",
};

export default function EmployeeStatusCharts({
  total,
  present,
  absent,
  statusBreakdown,
}: EmployeeStatusChartsProps) {
  const breakdown =
    statusBreakdown && statusBreakdown.length > 0
      ? statusBreakdown.filter((d) => d.value > 0)
      : [
          { name: "Present", value: present, fill: DEFAULT_COLORS.Present },
          { name: "Absent", value: absent, fill: DEFAULT_COLORS.Absent },
        ].filter((d) => d.value > 0);

  const barData = [
    { name: "All employees", value: total, fill: "#374151" },
    ...breakdown.map((d) => ({
      name: d.name,
      value: d.value,
      fill: d.fill || DEFAULT_COLORS[d.name] || "#6b7280",
    })),
  ];

  const rawMax = Math.max(...barData.map((d) => d.value), 1);
  const barAxisMax = Math.ceil(rawMax * 1.2) || 1;

  const pieData = total === 0 ? [] : breakdown;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
      <div className="h-[220px] w-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            barCategoryGap="18%"
          >
            <XAxis type="number" domain={[0, barAxisMax]} hide allowDataOverflow={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={108}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 600 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.02)" }}
              contentStyle={{
                borderRadius: 14,
                border: "1px solid #ececec",
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              }}
            />
            <Bar dataKey="value" radius={[0, 10, 10, 0]} maxBarSize={22}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-[220px] w-full min-h-[200px] relative">
        {total === 0 ? (
          <p className="text-sm text-gray-400 text-center pt-16">
            No employees in scope
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.fill ||
                      DEFAULT_COLORS[entry.name] ||
                      "#6b7280"
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid #ececec",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        {total > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {total}
              </p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Total
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
