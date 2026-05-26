"use client";

import {
  formatTaskDate,
  PriorityBadge,
  TaskMetaItem,
  TaskStatusBadge,
  initials,
} from "./task-ui";

interface Assignment {
  manageEmployeeID: number;
  manageEmployee?: { employeeFirstName?: string; employeeLastName?: string };
}

interface TaskDetailSidebarProps {
  status: string;
  priority: string;
  taskType: string;
  department?: string | null;
  customer?: string | null;
  branch?: string | null;
  schedule?: string | null;
  due?: string | null;
  assignments?: Assignment[];
  className?: string;
}

export function TaskDetailSidebar({
  status,
  priority,
  taskType,
  department,
  customer,
  branch,
  schedule,
  due,
  assignments = [],
  className = "",
}: TaskDetailSidebarProps) {
  return (
    <div className={`rounded-xl border border-gray-200/80 bg-white overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[13px] font-semibold text-gray-900">Details</p>
      </div>
      <div className="px-4 py-1">
        <div className="py-2.5 border-b border-gray-100 flex flex-wrap gap-2">
          <TaskStatusBadge status={status} />
          <PriorityBadge priority={priority} />
        </div>
        <TaskMetaItem label="Task type" value={taskType} />
        <TaskMetaItem label="Department" value={department} />
        <TaskMetaItem label="Customer" value={customer} />
        <TaskMetaItem label="Branch" value={branch} />
        <TaskMetaItem label="Schedule" value={schedule} />
        <TaskMetaItem label="Due date" value={due} />
        <div className="py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Assignees</p>
          {assignments.length === 0 ? (
            <p className="text-[13px] text-gray-400 mt-1">Unassigned</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              {assignments.map((a) => {
                const name = [a.manageEmployee?.employeeFirstName, a.manageEmployee?.employeeLastName]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <span
                    key={a.manageEmployeeID}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-700 bg-gray-50 border border-gray-100 rounded-full pl-1 pr-2.5 py-0.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#eef2ff] text-[#4f46e5] text-[9px] font-bold flex items-center justify-center">
                      {initials(name)}
                    </span>
                    {name || "Employee"}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskDetailHeader({
  taskCode,
  taskName,
  status,
  priority,
  onBack,
}: {
  taskCode: string;
  taskName: string;
  status: string;
  priority: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-gray-100">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-mono text-gray-400 mb-1">{taskCode}</p>
        <h2 className="text-lg font-semibold text-gray-900 leading-snug">{taskName}</h2>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <TaskStatusBadge status={status} />
          <PriorityBadge priority={priority} />
        </div>
      </div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Close
        </button>
      )}
    </div>
  );
}
