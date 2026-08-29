import type { TaskStatus } from "../components/task/task-types";
import { canonicalTaskStatus } from "../components/task/task-types";

/** Allowed workflow: Open → Work in Progress → Completed → Reopen → Open */
export const TASK_STATUS_FLOW: TaskStatus[] = [
  "Open",
  "Work in Progress",
  "Completed",
  "Reopen",
];

export const NEXT_TASK_STATUS: Record<string, TaskStatus> = {
  Open: "Work in Progress",
  WIP: "Completed",
  "Work in Progress": "Completed",
  Closed: "Reopen",
  Completed: "Reopen",
  Reopen: "Open",
  Scheduled: "Work in Progress",
  Rescheduled: "Work in Progress",
  "On-Hold": "Work in Progress",
};

export function nextTaskStatus(current: string): TaskStatus | null {
  return NEXT_TASK_STATUS[current] ?? NEXT_TASK_STATUS[canonicalTaskStatus(current)] ?? null;
}

export function isActiveTaskStatus(status: string) {
  const canonical = canonicalTaskStatus(status);
  return canonical === "Open" || canonical === "Work in Progress" || canonical === "Reopen" || canonical === "Scheduled" || canonical === "Rescheduled";
}
