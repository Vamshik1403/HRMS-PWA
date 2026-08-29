"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { PriorityBadge, TaskStatusBadge } from "../task-ui";
import {
  formatSitePunchAt,
  getNextSitePunchKindForTask,
  isSitePunchTaskType,
  sitePunchMenuLabel,
  sitePunchesFromTask,
  type SitePunchEvent,
} from "../../../utils/taskSitePunch";
import { taskAssigneeTeamLabel } from "../../../utils/empManagerDisplay";
import type { EmpManagerScope } from "../../../utils/empManagerDisplay";

export interface MobileTaskListItem {
  id: number;
  taskCode: string;
  taskName: string;
  taskType: string;
  status: string;
  priority: string;
  scheduleDateTime?: string | null;
  dueDateTime?: string | null;
  customer?: { customerName?: string };
  site?: { branchName?: string; city?: string };
  chats?: { message?: string | null; createdAt?: string; senderName?: string | null }[];
  sitePunches?: SitePunchEvent[];
  assignments?: {
    manageEmployeeID?: number;
    manageEmployee?: { employeeFirstName?: string; employeeLastName?: string; employeeID?: string };
  }[];
}

function fmtSchedule(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const tt = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dd} ${tt}`;
}

export function MobileTaskListCard({
  task,
  onOpenChat,
  onCheckInOut,
  onViewInfo,
  managerScope,
}: {
  task: MobileTaskListItem;
  onOpenChat: () => void;
  onCheckInOut?: () => void;
  onViewInfo?: () => void;
  managerScope?: EmpManagerScope | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fieldTask = isSitePunchTaskType(task.taskType);
  const siteLine = fieldTask
    ? [task.site?.branchName, task.site?.city].filter(Boolean).join(", ") || "—"
    : null;
  const punches = fieldTask ? sitePunchesFromTask(task) : [];
  const siteCheckLabel =
    fieldTask && onCheckInOut ? sitePunchMenuLabel(getNextSitePunchKindForTask(task)) : null;

  const teamLabel = taskAssigneeTeamLabel(managerScope ?? null, task.assignments);

  return (
    <div className="mobile-task-card w-full rounded-[16px] bg-white border border-gray-100 shadow-sm overflow-hidden">
      <button type="button" onClick={onOpenChat} className="w-full text-left px-3 py-3 active:bg-gray-50">
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            {teamLabel && (
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#2563eb]">
                Team · {teamLabel}
              </p>
            )}
            <p className="text-[14px] font-bold text-gray-900 leading-tight line-clamp-2">{task.taskName}</p>
            <p className="text-[11px] text-gray-500">
              <span className="text-gray-400">Task ID:</span> {task.id}
            </p>
            <p className="text-[11px] text-gray-500">
              <span className="text-gray-400">Type:</span> {task.taskType}
            </p>
            {siteLine && (
              <p className="text-[11px] text-gray-600 line-clamp-1">
                <span className="text-gray-400">Customer Site:</span> {siteLine}
              </p>
            )}
            <p className="text-[11px] text-gray-600">
              <span className="text-gray-400">Schedule:</span> {fmtSchedule(task.scheduleDateTime)}
            </p>
            <p className="text-[11px] text-gray-600">
              <span className="text-gray-400">ETC:</span> {fmtSchedule(task.dueDateTime)}
            </p>
            {fieldTask && (
              <div className="pt-0.5 space-y-0.5">
                {punches.length === 0 ? (
                  <p className="text-[11px] text-gray-400">No site check-in yet</p>
                ) : (
                  punches.map((p, i) => (
                    <p key={`${p.kind}-${p.at}-${i}`} className="text-[11px] text-gray-700">
                      <span className="text-gray-400">
                        {p.kind === "in" ? "Site check in:" : "Site check out:"}
                      </span>{" "}
                      {formatSitePunchAt(p.at)}
                      {p.employeeName ? (
                        <span className="text-gray-400"> · {p.employeeName}</span>
                      ) : null}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500"
              aria-label="Task menu"
            >
              <Icon icon="solar:menu-dots-bold" className="w-5 h-5" />
            </button>
            <TaskStatusBadge status={task.status} size="xs" className="!rounded-full" />
            <PriorityBadge priority={task.priority} size="xs" />
          </div>
        </div>
      </button>
      {menuOpen && (
        <div className="border-t border-gray-100 flex flex-wrap px-1 py-1 bg-gray-50/80">
          {siteCheckLabel && (
            <button type="button" className="text-[12px] font-semibold text-[#2563eb] px-3 py-2" onClick={() => { setMenuOpen(false); onCheckInOut?.(); }}>
              {siteCheckLabel}
            </button>
          )}
          {onViewInfo && (
            <button type="button" className="text-[12px] font-semibold text-gray-700 px-3 py-2" onClick={() => { setMenuOpen(false); onViewInfo(); }}>
              View Task Info
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function MobileTaskListSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[120px] rounded-[16px] bg-white border border-gray-100" />
      ))}
    </div>
  );
}
