"use client";

import { Icon } from "@iconify/react";

interface KpiCardProps {
  title: string;
  value: number;
  icon: string;
  iconBg: string;
  iconColor: string;
  change?: number;
  changeLabel?: string;
  total?: number;
  barColor?: string;
  accentBorder?: string;
  cardBg?: string;
  valueColor?: string;
}

export default function KpiCard({
  title,
  value,
  icon,
  iconBg,
  iconColor,
  change,
  changeLabel = "vs last month",
  cardBg,
  valueColor,
}: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className={`${cardBg || "bg-white"} rounded-2xl border border-[#e5e7eb] p-6 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg || "bg-[#f0f0ff]"} flex items-center justify-center`}>
          <Icon icon={icon} className={`w-5 h-5 ${iconColor || "text-[#6366f1]"}`} />
        </div>
        {change !== undefined && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              isPositive ? "text-emerald-500" : "text-red-400"
            }`}
          >
            <Icon
              icon={isPositive ? "mdi:arrow-up" : "mdi:arrow-down"}
              className="w-3.5 h-3.5"
            />
            {Math.abs(change)}%
          </span>
        )}
      </div>

      <p className={`text-2xl font-bold tracking-tight ${valueColor || "text-gray-900"}`}>{value.toLocaleString()}</p>
      <p className="text-sm text-gray-500 mt-1">{title}</p>

      {changeLabel && (
        <p className="text-xs text-gray-400 mt-3">{changeLabel}</p>
      )}
    </div>
  );
}
