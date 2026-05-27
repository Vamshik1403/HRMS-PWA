"use client";

import { Calendar, MessageSquare, User } from "lucide-react";
import type { TaskStatus } from "./task-types";

export type { TaskStatus } from "./task-types";
export { TASK_STATUSES } from "./task-types";

export const STATUS_META: Record<TaskStatus, {
  dot: string;
  ring: string;
  bg: string;
  text: string;
  border: string;
  accent: string;
  columnBg: string;
}> = {
  Open: {
    dot: "bg-[#4f46e5]",
    ring: "ring-[#4f46e5]/20",
    bg: "bg-[#eef2ff]",
    text: "text-[#4338ca]",
    border: "border-[#e0e7ff]",
    accent: "border-l-[#4f46e5]",
    columnBg: "bg-[#fafbff]",
  },
  WIP: {
    dot: "bg-[#f59e0b]",
    ring: "ring-[#f59e0b]/20",
    bg: "bg-[#fffbeb]",
    text: "text-[#b45309]",
    border: "border-[#fef3c7]",
    accent: "border-l-[#f59e0b]",
    columnBg: "bg-[#fffdf7]",
  },
  Closed: {
    dot: "bg-[#10b981]",
    ring: "ring-[#10b981]/20",
    bg: "bg-[#ecfdf5]",
    text: "text-[#047857]",
    border: "border-[#d1fae5]",
    accent: "border-l-[#10b981]",
    columnBg: "bg-[#f9fefb]",
  },
};

export const PRIORITY_META: Record<string, { dot: string; label: string; className: string }> = {
  Urgent: { dot: "bg-red-500", label: "Urgent", className: "bg-red-50 text-red-700 border-red-100" },
  Medium: { dot: "bg-amber-400", label: "Medium", className: "bg-amber-50 text-amber-700 border-amber-100" },
  Low: { dot: "bg-slate-400", label: "Low", className: "bg-slate-50 text-slate-600 border-slate-200" },
};

export function formatTaskDate(value?: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function formatTaskDateShort(value?: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return null;
  }
}

export function initials(name?: string | null) {
  const parts = (name || "U").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "U";
}

export function TaskStatusBadge({ status, size = "sm", className = "" }: { status: string; size?: "sm" | "xs"; className?: string }) {
  const meta = STATUS_META[status as TaskStatus] || STATUS_META.Open;
  const cls = size === "xs" ? "text-[10px] px-2 py-0.5 gap-1" : "text-xs px-2.5 py-1 gap-1.5";
  return (
    <span className={`inline-flex items-center rounded-md font-medium border ${cls} ${meta.bg} ${meta.text} ${meta.border} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority, size = "sm" }: { priority: string; size?: "sm" | "xs" }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.Medium;
  const cls = size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-medium border ${cls} ${meta.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export interface TaskCardData {
  id: number;
  taskCode: string;
  taskName: string;
  taskType: string;
  priority: string;
  status?: string;
  dueDateTime?: string | null;
  customer?: { customerName?: string };
  assignments?: { manageEmployee?: { employeeFirstName?: string; employeeLastName?: string } }[];
  _count?: { chats?: number };
}

export function DesktopTaskCard({ task, onClick }: { task: TaskCardData; onClick: () => void }) {
  const due = formatTaskDateShort(task.dueDateTime);
  const assignees = (task.assignments || []).slice(0, 3);
  const chatCount = task._count?.chats;
  const statusMeta = task.status ? STATUS_META[task.status as TaskStatus] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-lg border border-gray-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-[#4f46e5]/30 hover:shadow-[0_4px_12px_rgba(79,70,229,0.08)] transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-mono font-medium text-gray-400">{task.taskCode}</span>
        <PriorityBadge priority={task.priority} size="xs" />
      </div>
      <p className="text-[13px] font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-[#4f46e5] transition-colors">
        {task.taskName}
      </p>
      <p className="text-[11px] text-gray-500 mt-1.5 truncate">{task.taskType}</p>
      {task.customer?.customerName && (
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{task.customer.customerName}</p>
      )}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
        <div className="flex items-center gap-1.5 min-w-0">
          {assignees.length > 0 ? (
            <div className="flex -space-x-1">
              {assignees.map((a, i) => (
                <span
                  key={i}
                  className="w-5 h-5 rounded-full bg-gray-100 border border-white text-[8px] font-bold text-gray-600 flex items-center justify-center"
                  title={[a.manageEmployee?.employeeFirstName, a.manageEmployee?.employeeLastName].filter(Boolean).join(" ")}
                >
                  {initials([a.manageEmployee?.employeeFirstName, a.manageEmployee?.employeeLastName].filter(Boolean).join(" "))}
                </span>
              ))}
            </div>
          ) : (
            <User className="w-3 h-3 text-gray-300" />
          )}
          {chatCount ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 ml-1">
              <MessageSquare className="w-3 h-3" />{chatCount}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {statusMeta && <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />}
          {due && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
              <Calendar className="w-3 h-3" />{due}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function KanbanColumn({
  status,
  count,
  children,
}: {
  status: TaskStatus;
  count: number;
  children: React.ReactNode;
}) {
  const meta = STATUS_META[status];
  return (
    <div className={`flex flex-col rounded-xl border border-gray-200/80 overflow-hidden min-w-0 ${meta.columnBg}`}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/60 bg-white/70 backdrop-blur-sm sticky top-0 z-[1]">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
          <h3 className="text-[13px] font-semibold text-gray-800 truncate">{status}</h3>
        </div>
        <span className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.text}`}>
          {count}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-240px)] min-h-[120px]">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-3 rounded-lg border border-dashed border-gray-200/80 bg-white/50">
            <p className="text-[11px] text-gray-400">No {status.toLowerCase()} tasks</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function TaskBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-20 bg-white rounded-lg border border-gray-100" />
          <div className="h-20 bg-white rounded-lg border border-gray-100" />
        </div>
      ))}
    </div>
  );
}

export function MobileTaskCard({
  task,
  onClick,
}: {
  task: TaskCardData & { status: string };
  onClick: () => void;
}) {
  const meta = STATUS_META[task.status as TaskStatus] || STATUS_META.Open;
  const due = formatTaskDate(task.dueDateTime);
  const priority = PRIORITY_META[task.priority] || PRIORITY_META.Medium;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-white border border-gray-100 p-4 active:bg-gray-50/80 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-semibold text-gray-900 leading-snug truncate">{task.taskName}</p>
            <TaskStatusBadge status={task.status} size="xs" />
          </div>
          <p className="text-[11px] text-gray-400 font-mono mt-0.5">{task.taskCode}</p>
          <p className="text-[12px] text-gray-500 mt-1.5 truncate">
            {task.taskType}{task.customer?.customerName ? ` · ${task.customer.customerName}` : ""}
          </p>
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
              {priority.label}
            </span>
            <span className="text-[11px] text-gray-400">
              {due ? `Due ${due}` : "No due date"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function TaskMetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{label}</p>
      <p className="text-[13px] font-medium text-gray-900 mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}
