"use client";

import { useCallback, useEffect, useState } from "react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { taskFetch } from "../utils/taskApi";
import { MobileTaskChatView } from "../components/task/mobile/MobileTaskChatView";
import { MobileTaskListView } from "../components/task/mobile/MobileTaskListView";
import type { MobileTaskListItem } from "../components/task/mobile/MobileTaskListCard";
import { toast } from "sonner";

interface Task extends MobileTaskListItem {
  taskType: string;
  description?: string | null;
  department?: { departmentName?: string };
  chats?: { id: number; message: string; senderName?: string; createdAt: string }[];
}

export default function EmpMyTasksPage() {
  const user = useCurrentUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [detail, setDetail] = useState<Task | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [creating, setCreating] = useState(false);

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
      await taskFetch(`/task-projects/${detail.id}/chats`, user, {
        method: "POST",
        body: JSON.stringify({
          message: payload.message,
          attachmentUrl: payload.attachmentUrl,
          senderName: user.username,
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

  const createTask = async () => {
    if (!newTaskName.trim() || !user) return;
    setCreating(true);
    try {
      await taskFetch("/task-projects", user, {
        method: "POST",
        body: JSON.stringify({
          taskName: newTaskName.trim(),
          taskType: "Site Visit",
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
          }}
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
        onCreateClick={() => setCreateOpen(true)}
      />

      {createOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 mobile-sheet-backdrop"
            onClick={() => setCreateOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 mobile-sheet-up rounded-t-2xl bg-white px-5 pt-3 pb-6"
            style={{ paddingBottom: "max(24px, calc(16px + env(safe-area-inset-bottom)))" }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
            <h3 className="text-[17px] font-semibold text-gray-900 mb-3">New task</h3>
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Task name"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5]"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-[14px] font-medium text-gray-700 active:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createTask}
                disabled={creating || !newTaskName.trim()}
                className="flex-1 h-11 rounded-xl bg-[#4f46e5] text-white text-[14px] font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </>
      )}
    </EmpMobileLayout>
  );
}
