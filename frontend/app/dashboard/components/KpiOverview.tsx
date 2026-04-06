"use client";

import { Icon } from "@iconify/react";

interface KpiItem {
  title: string;
  value: string;
  icon: string;
  iconBg?: string;
  iconColor?: string;
  trend?: number;
  trendLabel?: string;
}

interface KpiOverviewProps {
  items: KpiItem[];
}

export default function KpiOverview({ items }: KpiOverviewProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-5">KPI Overview</h3>
      <div className="space-y-4">
        {items.map((item, i) => {
          const isPositive = item.trend !== undefined && item.trend >= 0;
          return (
            <div
              key={i}
              className="flex items-center justify-between py-3 border-b border-[#f3f4f6] last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${item.iconBg || "bg-[#f0f0ff]"} flex items-center justify-center`}>
                  <Icon icon={item.icon} className={`w-4 h-4 ${item.iconColor || "text-[#6366f1]"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.title}</p>
                  {item.trendLabel && (
                    <p className="text-xs text-gray-300 mt-0.5">{item.trendLabel}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{item.value}</p>
                {item.trend !== undefined && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                      isPositive ? "text-emerald-500" : "text-red-400"
                    }`}
                  >
                    <Icon
                      icon={isPositive ? "mdi:arrow-up" : "mdi:arrow-down"}
                      className="w-3 h-3"
                    />
                    {Math.abs(item.trend)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
