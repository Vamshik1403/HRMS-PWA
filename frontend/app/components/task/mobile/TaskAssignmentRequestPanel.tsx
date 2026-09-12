"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TaskStatusBadge } from "../task-ui";
import {
  assignmentRequestKindFromRow,
  isStalePendingAssignment,
  myEngineerAssignment,
  type EngineerAssignmentRow,
} from "../../../utils/taskAssignmentRequest";
import { taskSiteAddress } from "../../../utils/taskSiteVisit";

export type AssignmentRequestTask = {
  id: number;
  taskCode: string;
  taskName: string;
  taskType?: string;
  status: string;
  priority: string;
  scheduleDateTime?: string | null;
  dueDateTime?: string | null;
  dueAt?: string | null;
  expectedDurationMinutes?: number | null;
  siteAddress?: string | null;
  siteCity?: string | null;
  customer?: { customerName?: string };
  site?: { branchName?: string; city?: string; address?: string };
  engineerAssignments?: EngineerAssignmentRow[];
};

function fmtSchedule(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function TaskRequestInlineActions({
  task,
  employeeId,
  employeeEmail,
  sending,
  startRescheduleOpen = false,
  compact = false,
  onAccept,
  onReschedule,
}: {
  task: AssignmentRequestTask;
  employeeId?: number | null;
  employeeEmail?: string | null;
  sending?: boolean;
  startRescheduleOpen?: boolean;
  compact?: boolean;
  onAccept: () => void;
  onReschedule: (reason: string) => void;
}) {
  const mine = myEngineerAssignment(task, employeeId, employeeEmail);
  const kind = assignmentRequestKindFromRow(mine);
  const stale = isStalePendingAssignment(mine);
  const [rescheduleOpen, setRescheduleOpen] = useState(startRescheduleOpen);
  const [reason, setReason] = useState("");

  const submitReschedule = () => {
    const value = reason.trim();
    if (!value) return;
    onReschedule(value);
  };

  const noticeClass = compact
    ? "text-[12px] rounded-xl px-3 py-2"
    : "rounded-xl px-3 py-2.5 text-[13px]";

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {stale ? (
        <p className={`${noticeClass} text-amber-900 bg-amber-50 border border-amber-200`}>
          You have not accepted this task request.
        </p>
      ) : null}
      {kind === "waiting" ? (
        <p className={`${noticeClass} text-blue-900 bg-blue-50 border border-blue-100`}>
          Waiting for manager review
        </p>
      ) : null}
      <div
        className={
          compact
            ? "text-[12px] text-gray-700 space-y-1"
            : "rounded-2xl bg-white border border-gray-100 shadow-sm p-4 space-y-2 text-[13px]"
        }
      >
        <p>
          <span className="text-gray-400">Customer:</span> {task.customer?.customerName || "—"}
        </p>
        <p>
          <span className="text-gray-400">Site:</span>{" "}
          {taskSiteAddress(task) || [task.site?.branchName, task.site?.city].filter(Boolean).join(", ") || "—"}
        </p>
        <p>
          <span className="text-gray-400">Schedule:</span> {fmtSchedule(task.scheduleDateTime)}
        </p>
        {(task.dueAt || task.dueDateTime) ? (
          <p>
            <span className="text-gray-400">Due date & time:</span> {fmtSchedule(task.dueAt || task.dueDateTime)}
          </p>
        ) : null}
        {mine?.managerReason ? (
          <p>
            <span className="text-gray-400">Manager note:</span> {mine.managerReason}
          </p>
        ) : null}
        {kind === "waiting" && mine?.rescheduleReason ? (
          <p>
            <span className="text-gray-400">Your reason:</span> {mine.rescheduleReason}
          </p>
        ) : null}
      </div>
      {kind === "pending" ? (
        <div className={compact ? "space-y-2 pt-1" : "space-y-3"}>
          <button
            type="button"
            disabled={sending}
            onClick={onAccept}
            className={`w-full rounded-xl bg-[#2563eb] text-white font-semibold text-sm disabled:opacity-60 ${
              compact ? "py-2.5" : "py-3"
            }`}
          >
            Accept
          </button>
          {!rescheduleOpen ? (
            <button
              type="button"
              disabled={sending}
              onClick={() => setRescheduleOpen(true)}
              className={`w-full rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold text-sm disabled:opacity-60 ${
                compact ? "py-2.5" : "py-3"
              }`}
            >
              Request reschedule
            </button>
          ) : (
            <div className={compact ? "space-y-2" : "rounded-2xl bg-white border border-gray-100 p-3 space-y-2"}>
              {!compact ? (
                <label className="text-[12px] font-semibold text-gray-700" htmlFor="reschedule-reason">
                  Reason
                </label>
              ) : null}
              <textarea
                id={compact ? undefined : "reschedule-reason"}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={compact ? 3 : 4}
                placeholder="Why do you need this task rescheduled?"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[13px]"
              />
              <button
                type="button"
                disabled={sending || !reason.trim()}
                onClick={submitReschedule}
                className={`w-full rounded-xl bg-gray-900 text-white font-semibold text-sm disabled:opacity-60 ${
                  compact ? "py-2.5" : "py-3"
                }`}
              >
                Send reschedule request
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TaskAssignmentRequestPanel({
  task,
  employeeId,
  employeeEmail,
  sending,
  onBack,
  onAccept,
  onReschedule,
  embedded = false,
}: {
  task: AssignmentRequestTask;
  employeeId?: number | null;
  employeeEmail?: string | null;
  sending?: boolean;
  onBack: () => void;
  onAccept: () => void;
  onReschedule: (reason: string) => void;
  embedded?: boolean;
}) {
  const mine = myEngineerAssignment(task, employeeId, employeeEmail);
  const kind = assignmentRequestKindFromRow(mine);

  return (
    <div className={embedded ? "flex flex-col min-h-[70vh]" : "flex flex-col min-h-full bg-[#f8f9fb]"}>
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100 px-3 py-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-gray-900 truncate">{task.taskName}</p>
          <p className="text-[11px] font-mono text-gray-500">{task.taskCode}</p>
        </div>
        <TaskStatusBadge status={kind === "waiting" ? "On-Hold" : task.status} size="xs" />
      </header>

      <div className="flex-1 px-4 py-4">
        <TaskRequestInlineActions
          task={task}
          employeeId={employeeId}
          employeeEmail={employeeEmail}
          sending={sending}
          onAccept={onAccept}
          onReschedule={onReschedule}
        />
      </div>
    </div>
  );
}
