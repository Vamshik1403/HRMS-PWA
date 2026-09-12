"use client";

import { ListTodo } from "lucide-react";
import { Button } from "../../ui/button";
import { DataTable, type DataTableColumn } from "../../app/data-table";
import { useClientTable, sortRows } from "../../../hooks/use-client-table";
import { PriorityBadge, TaskStatusBadge } from "../../task/task-ui";
import type { MobileTaskListItem } from "../../task/mobile/MobileTaskListCard";
import {
  formatSitePunchAt,
  getNextSitePunchKindForTask,
  isSitePunchTaskType,
  lastSitePunchByKind,
  sitePunchMenuLabel,
  sitePunchesFromTask,
} from "../../../utils/taskSitePunch";
import { firstCheckInVisit, isEnplLinkedTask, lastCheckOutVisit } from "../../../utils/taskSiteVisit";
import { isAssignmentRequestTask } from "../../../utils/taskAssignmentRequest";
import { TaskRequestInlineActions } from "../../task/mobile/TaskAssignmentRequestPanel";

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

function punchCell(task: MobileTaskListItem, kind: "in" | "out") {
  if (isEnplLinkedTask(task)) {
    const visit = kind === "in" ? firstCheckInVisit(task) : lastCheckOutVisit(task);
    const at = visit?.at || visit?.createdAt;
    return (
      <span className="text-xs tabular-nums whitespace-nowrap">
        {at ? formatSitePunchAt(at) : "—"}
      </span>
    );
  }
  if (!isSitePunchTaskType(task.taskType)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const punches = sitePunchesFromTask(task);
  const last = lastSitePunchByKind(punches, kind);
  const count = punches.filter((p) => p.kind === kind).length;
  return (
    <span className="text-xs tabular-nums whitespace-nowrap">
      {last ? formatSitePunchAt(last.at) : "—"}
      {count > 1 ? <span className="text-muted-foreground"> ({count})</span> : null}
    </span>
  );
}

export function EmpDesktopTaskTable({
  tasks,
  loading,
  onOpen,
  onSitePunch,
  employeeId,
  employeeEmail,
  sendingAction,
  rescheduleTaskId,
  onAcceptRequest,
  onRescheduleRequest,
}: {
  tasks: MobileTaskListItem[];
  loading?: boolean;
  onOpen: (task: MobileTaskListItem) => void;
  onSitePunch?: (task: MobileTaskListItem) => void;
  employeeId?: number | null;
  employeeEmail?: string | null;
  sendingAction?: boolean;
  rescheduleTaskId?: number | null;
  onAcceptRequest?: (task: MobileTaskListItem) => void;
  onRescheduleRequest?: (task: MobileTaskListItem, reason: string) => void;
}) {
  const { sortBy, sortDir, setSort } = useClientTable("scheduleDateTime");

  const sorted = sortRows(tasks, sortBy, sortDir, (t, key) => {
    if (key === "id") return t.id;
    if (key === "taskName") return t.taskName;
    if (key === "taskType") return t.taskType;
    if (key === "status") return t.status;
    if (key === "priority") return t.priority;
    if (key === "scheduleDateTime") return t.scheduleDateTime || "";
    if (key === "dueDateTime") return t.dueDateTime || "";
    return "";
  });

  const columns: DataTableColumn<MobileTaskListItem>[] = [
    {
      key: "taskName",
      header: "Task",
      sortable: true,
      cell: (t) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{t.taskName}</p>
          <p className="text-xs text-muted-foreground font-mono">{t.taskCode}</p>
        </div>
      ),
    },
    {
      key: "id",
      header: "ID",
      sortable: true,
      cell: (t) => <span className="text-sm tabular-nums">{t.id}</span>,
    },
    {
      key: "taskType",
      header: "Type",
      sortable: true,
      cell: (t) => <span className="text-sm">{t.taskType}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (t) => <TaskStatusBadge status={t.status} size="xs" />,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      cell: (t) => <PriorityBadge priority={t.priority} size="xs" />,
    },
    {
      key: "scheduleDateTime",
      header: "Schedule",
      sortable: true,
      cell: (t) => <span className="text-xs tabular-nums whitespace-nowrap">{fmtSchedule(t.scheduleDateTime)}</span>,
    },
    {
      key: "dueDateTime",
      header: "Due date & time",
      sortable: true,
      cell: (t) => <span className="text-xs tabular-nums whitespace-nowrap">{fmtSchedule(t.dueAt || t.dueDateTime)}</span>,
    },
    {
      key: "siteCheckIn",
      header: "Site check in",
      cell: (t) => punchCell(t, "in"),
    },
    {
      key: "siteCheckOut",
      header: "Site check out",
      cell: (t) => punchCell(t, "out"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (t) =>
        isAssignmentRequestTask(t, employeeId, employeeEmail) && onAcceptRequest && onRescheduleRequest ? (
          <div className="min-w-[220px] max-w-[280px] text-left">
            <TaskRequestInlineActions
              task={t}
              employeeId={employeeId}
              employeeEmail={employeeEmail}
              sending={sendingAction}
              startRescheduleOpen={rescheduleTaskId === t.id}
              compact
              onAccept={() => onAcceptRequest(t)}
              onReschedule={(reason) => onRescheduleRequest(t, reason)}
            />
          </div>
        ) : (
          <div className="flex justify-end gap-1 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => onOpen(t)}>
              Open
            </Button>
            {(isSitePunchTaskType(t.taskType) || isEnplLinkedTask(t)) && onSitePunch ? (
              <Button variant="outline" size="sm" onClick={() => onSitePunch(t)}>
                {sitePunchMenuLabel(getNextSitePunchKindForTask(t))}
              </Button>
            ) : null}
          </div>
        ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <DataTable
        columns={columns}
        rows={sorted}
        rowKey={(t) => String(t.id)}
        isLoading={!!loading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={setSort}
        emptyIcon={ListTodo}
        emptyTitle="No tasks"
        emptyDescription="Assigned tasks will appear here."
      />
    </div>
  );
}
