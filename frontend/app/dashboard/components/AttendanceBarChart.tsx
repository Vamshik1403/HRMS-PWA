"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface WeekDay {
  day: string;
  present: number;
  absent: number;
  total: number;
}

interface AttendanceBarChartProps {
  data: WeekDay[];
}

export default function AttendanceBarChart({ data }: AttendanceBarChartProps) {
  return (
    <div className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barSize={14} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 500 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            allowDecimals={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
              fontSize: "11px",
              padding: "8px 14px",
              background: "#fff",
            }}
            cursor={{ fill: "rgba(0,0,0,0.015)" }}
          />
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: "#9ca3af" }}
          />
          <Bar dataKey="present" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Present" />
          <Bar dataKey="absent" fill="#fb7185" radius={[6, 6, 0, 0]} name="Absent" />
          <Bar dataKey="total" fill="#a5b4fc" radius={[6, 6, 0, 0]} name="Total" opacity={0.5} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
