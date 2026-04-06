"use client";

import { Icon } from "@iconify/react";

export interface Activity {
  id: number;
  name: string;
  action: string;
  time: string;
  avatarInitial: string;
  avatarBg: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Recent Activities
      </h3>
      {activities.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No recent activities
        </p>
      ) : (
        <div className="space-y-1">
          {activities.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#f8fafc] transition-colors duration-150"
            >
              <div
                className={`w-8 h-8 rounded-full ${a.avatarBg} flex items-center justify-center text-white font-semibold text-xs shrink-0`}
              >
                {a.avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">
                  <span className="font-semibold">{a.name}</span>{" "}
                  <span className="text-gray-400">{a.action}</span>
                </p>
              </div>
              <span className="text-xs text-gray-300 whitespace-nowrap">{a.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
