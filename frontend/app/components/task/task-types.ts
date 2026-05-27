export type TaskStatus = "Open" | "WIP" | "Closed";
export const TASK_STATUSES: TaskStatus[] = ["Open", "WIP", "Closed"];

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
