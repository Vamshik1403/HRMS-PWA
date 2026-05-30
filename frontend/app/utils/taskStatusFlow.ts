import type { TaskStatus } from "../components/task/task-types";

/** Allowed workflow: Open → WIP → Closed → Reopen → Open */
export const TASK_STATUS_FLOW: TaskStatus[] = ["Open", "WIP", "Closed", "Reopen"];

export const NEXT_TASK_STATUS: Record<TaskStatus, TaskStatus> = {
  Open: "WIP",
  WIP: "Closed",
  Closed: "Reopen",
  Reopen: "Open",
};

export function nextTaskStatus(current: string): TaskStatus | null {
  const key = current as TaskStatus;
  return NEXT_TASK_STATUS[key] ?? null;
}

export function isActiveTaskStatus(status: string) {
  return status === "Open" || status === "WIP" || status === "Reopen";
}
