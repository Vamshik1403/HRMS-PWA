export type TaskStatus =
  | "Open"
  | "WIP"
  | "Work in Progress"
  | "Scheduled"
  | "Rescheduled"
  | "On-Hold"
  | "Closed"
  | "Completed"
  | "Reopen";

export const TASK_STATUSES: TaskStatus[] = [
  "Open",
  "Scheduled",
  "Work in Progress",
  "Rescheduled",
  "On-Hold",
  "Completed",
  "Reopen",
];

export function canonicalTaskStatus(status?: string | null): TaskStatus {
  const value = String(status || "").trim();
  if (value === "WIP") return "Work in Progress";
  if (value === "Closed") return "Completed";
  if (
    value === "Open" ||
    value === "Scheduled" ||
    value === "Work in Progress" ||
    value === "Rescheduled" ||
    value === "On-Hold" ||
    value === "Completed" ||
    value === "Reopen"
  ) {
    return value;
  }
  return "Open";
}

export interface TaskActivity {
  id: number;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
  remark?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface TaskChatMessage {
  id: number;
  message: string;
  senderName?: string | null;
  attachmentUrl?: string | null;
  createdAt: string;
}
