"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { taskFetch } from "../utils/taskApi";
import { TaskDetailTabs } from "../components/task/TaskDetailTabs";
import {
  MobileTaskCard,
  TASK_STATUSES,
  TaskStatusBadge,
  PriorityBadge,
  formatTaskDate,
  TaskMetaItem,
  TaskBoardSkeleton,
  type TaskStatus,
} from "../components/task/task-ui";
import { toast } from "sonner";

interface Task {
  id: number;
  taskCode: string;
  taskName: string;
  status: string;
  priority: string;
  taskType: string;
  dueDateTime?: string | null;
  scheduleDateTime?: string | null;
  description?: string | null;
  customer?: { customerName: string };
  site?: { branchName?: string };
  department?: { departmentName?: string };
  chats?: { id: number; message: string; senderName?: string; createdAt: string }[];
  activities?: { id: number; action: string; oldValue?: string; newValue?: string; remark?: string; actorName?: string; createdAt: string }[];
}

type FilterTab = "All" | TaskStatus;

export default function EmpMyTasksPage() {
  const user = useCurrentUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Task | null>(null);
  const [detail, setDetail] = useState<Task | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("All");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await taskFetch<{ items: Task[] }>("/task-projects", user, undefined, { limit: 50 });
      setTasks(data.items);
    } catch (e: any) {
      toast.error(e.message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const filteredTasks = useMemo(() => {
    if (filter === "All") return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const counts = useMemo(() => ({
    All: tasks.length,
    Open: tasks.filter((t) => t.status === "Open").length,
    WIP: tasks.filter((t) => t.status === "WIP").length,
    Closed: tasks.filter((t) => t.status === "Closed").length,
  }), [tasks]);

  const openTask = async (t: Task) => {
    setSelected(t);
    try {
      const full = await taskFetch<Task>(`/task-projects/${t.id}`, user);
      setDetail(full);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const sendMsg = async () => {
    if (!selected || !msg.trim() || !user) return;
    setSending(true);
    try {
      await taskFetch(`/task-projects/${selected.id}/chats`, user, {
        method: "POST",
        body: JSON.stringify({ message: msg, senderName: user.username }),
      });
      setMsg("");
      openTask(selected);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  if (selected && detail) {
    return (
      <EmpMobileLayout>
        <div className="min-h-[100dvh] bg-[#f8fafc] pb-24">
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setSelected(null); setDetail(null); }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                aria-label="Back"
              >
                <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-gray-900 truncate">{detail.taskName}</p>
                <p className="text-[11px] font-mono text-gray-400">{detail.taskCode}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-12">
              <TaskStatusBadge status={detail.status} size="xs" />
              <PriorityBadge priority={detail.priority} size="xs" />
            </div>
          </div>

          <div className="px-4 py-4 space-y-3">
            <div className="rounded-2xl bg-white border border-gray-100 px-4 py-1">
              <TaskMetaItem label="Customer" value={detail.customer?.customerName} />
              <TaskMetaItem label="Branch" value={detail.site?.branchName} />
              <TaskMetaItem label="Department" value={detail.department?.departmentName} />
              <TaskMetaItem label="Due" value={formatTaskDate(detail.dueDateTime) || "Not set"} />
            </div>

            {detail.description && (
              <div className="rounded-2xl bg-white border border-gray-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Description</p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{detail.description}</p>
              </div>
            )}

            <TaskDetailTabs
              key={detail.id}
              chats={detail.chats || []}
              activities={detail.activities || []}
              currentUserName={user?.username}
              message={msg}
              onMessageChange={setMsg}
              onSend={sendMsg}
              sending={sending}
              placeholder="Write a message…"
              compact
              fluid
            />
          </div>
        </div>
      </EmpMobileLayout>
    );
  }

  const tabs: FilterTab[] = ["All", ...TASK_STATUSES];

  return (
    <EmpMobileLayout>
      <div className="min-h-[100dvh] bg-[#f8fafc] px-4 pt-4 pb-24">
        <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">My Tasks</h1>
        <p className="text-[12px] text-gray-500 mt-0.5 mb-3">Assigned and created tasks</p>

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                filter === tab
                  ? "bg-[#4f46e5] text-white border-[#4f46e5]"
                  : "bg-white text-gray-600 border-gray-100 active:bg-gray-50"
              }`}
            >
              {tab}
              <span className={`ml-1 tabular-nums ${filter === tab ? "text-indigo-200" : "text-gray-400"}`}>
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <TaskBoardSkeleton />
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center mb-3">
              <Icon icon="solar:clipboard-list-linear" className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-[14px] font-medium text-gray-800">No tasks here</p>
            <p className="text-[12px] text-gray-500 mt-1 max-w-[220px]">
              {filter === "All" ? "Tasks assigned to you will appear here" : `No ${filter} tasks at the moment`}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTasks.map((t) => (
              <MobileTaskCard key={t.id} task={t} onClick={() => openTask(t)} />
            ))}
          </div>
        )}
      </div>
    </EmpMobileLayout>
  );
}
