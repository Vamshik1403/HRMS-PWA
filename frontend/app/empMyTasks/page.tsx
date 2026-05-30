"use client";

import { useCallback, useEffect, useState } from "react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { taskFetch } from "../utils/taskApi";
import { MobileTaskChatView } from "../components/task/mobile/MobileTaskChatView";
import { MobileTaskListView } from "../components/task/mobile/MobileTaskListView";
import type { MobileTaskListItem } from "../components/task/mobile/MobileTaskListCard";
import { toast } from "sonner";
import { getNextSitePunchKind, sitePunchLabel } from "../utils/taskSitePunch";
import { nextTaskStatus } from "../utils/taskStatusFlow";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface Task extends MobileTaskListItem {
  taskType: string;
  description?: string | null;
  scheduleDateTime?: string | null;
  department?: { departmentName?: string };
  chats?: { id: number; message: string; senderName?: string; createdAt: string }[];
  assignments?: { manageEmployee?: { employeeFirstName?: string; employeeLastName?: string } }[];
}

export default function EmpMyTasksPage() {
  const user = useCurrentUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [detail, setDetail] = useState<Task | null>(null);
  const [infoTask, setInfoTask] = useState<Task | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [creating, setCreating] = useState(false);
  const [canCreateTask, setCanCreateTask] = useState(false);

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
    if (!user?.username) return;
    load();
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((creds) => {
        const empId = creds?.employee?.id;
        if (!empId) return;
        return fetch(`${BACKEND}/manage-emp/${empId}`).then((r) => (r.ok ? r.json() : null));
      })
      .then((emp) => setCanCreateTask(!!emp?.allowCreateTaskOnMobile))
      .catch(() => setCanCreateTask(false));
  }, [user, load]);

  const openTask = async (t: Task) => {
    try {
      const full = await taskFetch<Task>(`/task-projects/${t.id}`, user);
      setChatMsg("");
      setDetail(full);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    try {
      const full = await taskFetch<Task>(`/task-projects/${detail.id}`, user);
      setDetail(full);
    } catch {
      /* ignore */
    }
  };

  const sendMsg = async (payload: { message: string; attachmentUrl?: string }) => {
    if (!detail || !user) return;
    if (!payload.message.trim() && !payload.attachmentUrl) return;
    setSending(true);
    try {
      const employeeId = (user as { employee?: { id?: number } }).employee?.id ?? user.id;
      await taskFetch(`/task-projects/${detail.id}/chats`, user, {
        method: "POST",
        body: JSON.stringify({
          message: payload.message,
          attachmentUrl: payload.attachmentUrl,
          senderName: user.username,
          employeeID: employeeId,
          remark: payload.message || "Image attachment",
        }),
      });
      setChatMsg("");
      await refreshDetail();
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const postSitePunch = async (taskId: number, chats?: { message?: string; createdAt?: string }[]) => {
    if (!user) return;
    const kind = getNextSitePunchKind(chats);
    const label = sitePunchLabel(kind);
    const msg = `${label} at ${new Date().toLocaleString("en-IN")}`;
    const employeeId = (user as { employee?: { id?: number } }).employee?.id ?? user.id;
    setSending(true);
    try {
      await taskFetch(`/task-projects/${taskId}/chats`, user, {
        method: "POST",
        body: JSON.stringify({
          message: msg,
          senderName: user.username,
          employeeID: employeeId,
          remark: msg,
        }),
      });
      toast.success(label);
      if (detail?.id === taskId) await refreshDetail();
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const sitePunch = async () => {
    if (!detail) return;
    await postSitePunch(detail.id, detail.chats);
  };

  const updateStatus = async (status: string) => {
    if (!detail || !user) return;
    try {
      await taskFetch(`/task-projects/${detail.id}`, user, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const labels: Record<string, string> = {
        Closed: "Task closed",
        Reopen: "Task reopened",
        Open: "Task set to Open",
        WIP: "Task in progress",
      };
      toast.success(labels[status] || "Status updated");
      await refreshDetail();
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update status");
    }
  };

  const createTask = async () => {
    if (!newTaskName.trim() || !user) return;
    setCreating(true);
    try {
      await taskFetch("/task-projects", user, {
        method: "POST",
        body: JSON.stringify({
          taskName: newTaskName.trim(),
          taskType: "Work task",
          priority: "Medium",
        }),
      });
      toast.success("Task created");
      setCreateOpen(false);
      setNewTaskName("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not create task");
    } finally {
      setCreating(false);
    }
  };

  if (detail) {
    return (
      <EmpMobileLayout hideBottomNav>
        <MobileTaskChatView
          task={detail}
          currentUserName={user?.username}
          message={chatMsg}
          onMessageChange={setChatMsg}
          onSend={sendMsg}
          sending={sending}
          onBack={() => {
            setDetail(null);
            setChatMsg("");
            load();
          }}
          onAdvanceStatus={() => {
            const next = nextTaskStatus(detail.status);
            if (next) void updateStatus(next);
          }}
          onSitePunch={sitePunch}
          sitePunchNextKind={detail ? getNextSitePunchKind(detail.chats) : "in"}
        />
      </EmpMobileLayout>
    );
  }

  return (
    <EmpMobileLayout>
      <MobileTaskListView
        tasks={tasks}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onTaskClick={(t) => openTask(t as Task)}
        onCheckInOut={async (t) => {
          try {
            const full = await taskFetch<Task>(`/task-projects/${t.id}`, user);
            await postSitePunch(t.id, full.chats);
          } catch (e: any) {
            toast.error(e.message || "Could not record site attendance");
          }
        }}
        onViewInfo={(t) => setInfoTask(t as Task)}
        onCreateClick={canCreateTask ? () => setCreateOpen(true) : undefined}
        showCreateFab={canCreateTask}
      />

      {infoTask && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setInfoTask(null)} />
          <div className="fixed inset-x-4 top-[15%] z-50 bg-white rounded-2xl shadow-xl p-5 max-h-[70vh] overflow-y-auto">
            <h3 className="text-[17px] font-bold text-gray-900 mb-3">{infoTask.taskName}</h3>
            <div className="space-y-2 text-[13px]">
              <p><span className="text-gray-500">Task ID:</span> {infoTask.id}</p>
              <p><span className="text-gray-500">Type:</span> {infoTask.taskType}</p>
              <p><span className="text-gray-500">Status:</span> {infoTask.status}</p>
              <p><span className="text-gray-500">Priority:</span> {infoTask.priority}</p>
              {(infoTask.taskType || "").toLowerCase().includes("site visit") && (
                <p><span className="text-gray-500">Site:</span> {infoTask.site?.branchName || "—"}</p>
              )}
            </div>
            <button type="button" className="mt-4 w-full py-2.5 rounded-xl bg-[#2563eb] text-white font-semibold text-sm" onClick={() => { setInfoTask(null); openTask(infoTask); }}>
              Open chat
            </button>
          </div>
        </>
      )}

      {createOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setCreateOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl px-5 pt-3 pb-6" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
            <h3 className="text-[17px] font-semibold text-gray-900 mb-3">New task</h3>
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Task name"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-[15px]"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-[14px]">Cancel</button>
              <button type="button" onClick={createTask} disabled={creating || !newTaskName.trim()} className="flex-1 h-11 rounded-xl bg-[#4f46e5] text-white text-[14px] font-semibold disabled:opacity-50">
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </>
      )}
    </EmpMobileLayout>
  );
}
