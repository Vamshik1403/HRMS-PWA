"use client";

import { useCallback, useEffect, useState } from "react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { taskFetch } from "../utils/taskApi";
import { MobileTaskChatView } from "../components/task/mobile/MobileTaskChatView";
import { MobileTaskListView } from "../components/task/mobile/MobileTaskListView";
import type { MobileTaskListItem } from "../components/task/mobile/MobileTaskListCard";
import {
  MobileTaskCreateSheet,
  type CreatorEmp,
} from "../components/task/mobile/MobileTaskCreateSheet";
import { toast } from "sonner";
import { fetchGPSOnUserGesture } from "../utils/empGeolocation";
import { getNextSitePunchKind, sitePunchLabel } from "../utils/taskSitePunch";
import { downloadTaskReportForId } from "../utils/taskReportPdf";
import { useTaskChatPolling } from "../hooks/useTaskChatPolling";
import { useEmpManagerScope } from "../hooks/useEmpManagerScope";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface Task extends MobileTaskListItem {
  taskType: string;
  description?: string | null;
  scheduleDateTime?: string | null;
  department?: { departmentName?: string };
  chats?: { id: number; message: string; senderName?: string; createdAt: string }[];
  assignments?: { manageEmployeeID?: number; manageEmployee?: { employeeFirstName?: string; employeeLastName?: string } }[];
}

export default function EmpMyTasksPage() {
  const user = useCurrentUser();
  const { scope, isManagerView } = useEmpManagerScope();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [detail, setDetail] = useState<Task | null>(null);
  const [infoTask, setInfoTask] = useState<Task | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [canCreateTask, setCanCreateTask] = useState(false);
  const [creatorEmp, setCreatorEmp] = useState<CreatorEmp | null>(null);

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
      .then((emp) => {
        if (!emp) {
          setCanCreateTask(false);
          setCreatorEmp(null);
          return;
        }
        setCanCreateTask(!!emp.allowCreateTaskOnMobile);
        setCreatorEmp({
          id: emp.id,
          companyID: emp.companyID,
          departmentNameID: emp.departmentNameID,
        });
      })
      .catch(() => {
        setCanCreateTask(false);
        setCreatorEmp(null);
      });
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

  useTaskChatPolling<Task>(
    detail?.id,
    user,
    (full) => setDetail((prev) => (prev?.id === full.id ? full : prev)),
    !!detail,
  );

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
    let locationBlock = "";
    try {
      const coords = await fetchGPSOnUserGesture();
      const addrRes = await fetch(
        `${BACKEND}/devices/resolve-address?latitude=${encodeURIComponent(String(coords.latitude))}&longitude=${encodeURIComponent(String(coords.longitude))}`,
        { cache: "no-store" },
      );
      const addrJson = addrRes.ok ? await addrRes.json() : {};
      const address = typeof addrJson.address === "string" ? addrJson.address : "";
      locationBlock = `\nLocation: ${address || "—"}\nCoordinates: ${coords.latitude}, ${coords.longitude}`;
    } catch {
      locationBlock = "\nLocation: unavailable";
    }
    const msg = `${label} at ${new Date().toLocaleString("en-IN")}${locationBlock}`;
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

  if (detail) {
    return (
      <EmpMobileLayout hideBottomNav>
        <MobileTaskChatView
          task={detail}
          currentUserName={user?.username}
          currentEmployeeId={
            (user as { employee?: { id?: number } })?.employee?.id ??
            (typeof user?.id === "number" ? user.id : undefined)
          }
          message={chatMsg}
          onMessageChange={setChatMsg}
          onSend={sendMsg}
          sending={sending}
          onBack={() => {
            setDetail(null);
            setChatMsg("");
            load();
          }}
          onSitePunch={sitePunch}
          sitePunchNextKind={detail ? getNextSitePunchKind(detail.chats) : "in"}
          onDownloadReport={async () => {
            try {
              await downloadTaskReportForId(detail.id, user, detail.taskCode);
              toast.success("Report downloaded");
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : "Failed to download report");
            }
          }}
        />
      </EmpMobileLayout>
    );
  }

  return (
    <EmpMobileLayout hideBottomNav={createOpen}>
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
        managerScope={scope}
        isManagerView={isManagerView}
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

      <MobileTaskCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        user={user}
        creatorEmp={creatorEmp}
        onCreated={() => load()}
      />
    </EmpMobileLayout>
  );
}
