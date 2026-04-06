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

interface EmployeeStatusChartsProps {
  total: number;
  present: number;
  absent: number;
}

export default function EmployeeStatusCharts({
  total,
  present,
  absent,
}: EmployeeStatusChartsProps) {
  const barData = [
    { name: "All employees", value: total, fill: "#374151" },
    { name: "Present", value: present, fill: "#22c55e" },
    { name: "Absent", value: absent, fill: "#fb7185" },
  ];

  const rawMax = Math.max(total, present, absent, 1);
  // Add 20% headroom so bars never fill the full width, giving a proportional feel
  const barAxisMax = Math.ceil(rawMax * 1.2) || 1;

  const pieData =
    total === 0
      ? []
      : [
          { name: "Present", value: present },
          { name: "Absent", value: Math.max(0, absent) },
        ].filter((d) => d.value > 0);

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
            <XAxis
              type="number"
              domain={[0, barAxisMax]}
              hide
              allowDataOverflow={false}
            />
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
                      entry.name === "Present" ? "#22c55e" : "#fb7185"
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
