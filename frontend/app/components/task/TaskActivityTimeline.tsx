"use client";

import {
  ArrowRightLeft,
  CircleDot,
  Flag,
  Plus,
  StickyNote,
} from "lucide-react";
import type { TaskActivity } from "./task-types";
import { formatTaskDate } from "./task-ui";

function activityIcon(action: string) {
  switch (action) {
    case "CREATED": return Plus;
    case "STATUS_CHANGE": return ArrowRightLeft;
    case "PRIORITY_CHANGE": return Flag;
    case "REMARK": return StickyNote;
    default: return CircleDot;
  }
}

function activityLabel(a: TaskActivity) {
  switch (a.action) {
    case "CREATED":
      return "Task created";
    case "STATUS_CHANGE":
      return a.oldValue && a.newValue ? `${a.oldValue} → ${a.newValue}` : "Status updated";
    case "PRIORITY_CHANGE":
      return a.oldValue && a.newValue ? `${a.oldValue} → ${a.newValue}` : "Priority updated";
    case "REMARK":
      return a.remark || "Remark added";
    case "CHAT":
      return "Message sent";
    default:
      return a.action.replace(/_/g, " ");
  }
}

export function TaskActivityTimeline({
  activities,
  className = "",
  maxHeight = "max-h-64",
  showEmpty = false,
}: {
  activities: TaskActivity[];
  className?: string;
  maxHeight?: string;
  showEmpty?: boolean;
}) {
  if (!activities.length) {
    if (!showEmpty) return null;
    return (
      <div className={`rounded-xl border border-gray-200/80 bg-white overflow-hidden ${className}`}>
        <div className="px-4 py-10 text-center">
          <p className="text-[13px] text-gray-500">No activity yet</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Task events will appear here</p>
        </div>
      </div>
    );
  }

  const sorted = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className={`rounded-xl border border-gray-200/80 bg-white overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[13px] font-semibold text-gray-900">Activity</p>
      </div>
      <div className={`overflow-y-auto ${maxHeight} px-4 py-3`}>
        <div className="relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-100" />
          <div className="space-y-4">
            {sorted.map((a) => {
              const Icon = activityIcon(a.action);
              return (
                <div key={a.id} className="relative flex gap-3 pl-0">
                  <div className="relative z-[1] w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    <Icon className="w-3 h-3 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[12px] font-medium text-gray-900">{activityLabel(a)}</p>
                    {a.remark && a.action !== "REMARK" && (
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{a.remark}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {a.actorName || "System"} · {formatTaskDate(a.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
