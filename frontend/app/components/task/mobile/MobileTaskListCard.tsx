"use client";

import { Calendar } from "lucide-react";
import { PriorityBadge, TaskStatusBadge, formatTaskDateShort } from "../task-ui";

export interface MobileTaskListItem {
  id: number;
  taskCode: string;
  taskName: string;
  status: string;
  priority: string;
  dueDateTime?: string | null;
  customer?: { customerName?: string };
  site?: { branchName?: string };
}

export function MobileTaskListCard({
  task,
  onClick,
}: {
  task: MobileTaskListItem;
  onClick: () => void;
}) {
  const due = formatTaskDateShort(task.dueDateTime);
  const location = [task.customer?.customerName, task.site?.branchName].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="mobile-task-card w-full text-left rounded-[20px] bg-white px-3.5 py-3 shadow-[0_2px_12px_rgba(15,23,42,0.06)] border border-gray-100/80 active:scale-[0.98] transition-transform duration-150"
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold text-gray-900 leading-tight line-clamp-2 pr-1">
              {task.taskName}
            </p>
            <TaskStatusBadge status={task.status} size="xs" className="shrink-0 !rounded-full" />
          </div>
          <p className="text-[11px] font-mono text-gray-400 mt-0.5 tracking-tight">{task.taskCode}</p>
          {location && (
            <p className="text-[12px] text-gray-500 mt-1 line-clamp-1">{location}</p>
          )}
          <div className="flex items-center justify-between mt-2 gap-2">
            <PriorityBadge priority={task.priority} size="xs" />
            {due && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                <Calendar className="w-3.5 h-3.5" />
                {due}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export function MobileTaskListSkeleton() {
  return (
    <div className="space-y-2 animate-pulse px-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[88px] rounded-[20px] bg-white border border-gray-100" />
      ))}
    </div>
  );
}
