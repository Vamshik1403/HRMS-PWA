"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListTodo, Plus } from "lucide-react";
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
import {
  getNextSitePunchKindForTask,
  sitePunchLabel,
  formatSitePunchAt,
  isSitePunchTaskType,
  sitePunchesFromTask,
} from "../utils/taskSitePunch";
import { downloadTaskReportForId } from "../utils/taskReportPdf";
import { useTaskChatPolling } from "../hooks/useTaskChatPolling";
import { useEmpManagerScope } from "../hooks/useEmpManagerScope";
import { EmpDesktopPage } from "../components/emp/desktop/EmpDesktopPage";
import { EmpDesktopTaskTable } from "../components/emp/desktop/EmpDesktopTaskTable";
import { EmpTeamStyleDataSection } from "../components/emp/desktop/EmpTeamStyleDataSection";
import { useEmpPortalDesktop } from "../components/layout/EmpPortalShell";
import { Button } from "../components/ui/button";
import { FormModal } from "../components/ui/form-modal";
import { canonicalTaskStatus } from "../components/task/task-types";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const STATUS_TABS = ["Open", "WIP", "Closed", "Reopen"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

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
  const isDesktop = useEmpPortalDesktop();
  const { scope, isManagerView } = useEmpManagerScope();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("Open");
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
      const data = await taskFetch<{ items: Task[] }>("/task-projects", user, undefined, {
        limit: 50,
        assignedToMe: 1,
      });
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
        if (typeof creds?.employee?.allowCreateTaskOnMobile === "boolean") {
          setCanCreateTask(!!creds.employee.allowCreateTaskOnMobile);
        }
        const empId = creds?.employee?.id ?? user.employee?.id;
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

  const postSitePunch = async (
    taskId: number,
    taskOrChats?:
      | { message?: string; createdAt?: string }[]
      | {
          chats?: { message?: string; createdAt?: string }[];
          sitePunches?: { kind?: string; at?: string; createdAt?: string; message?: string | null }[];
        },
  ) => {
    if (!user) return;
    const punchSource = Array.isArray(taskOrChats) ? { chats: taskOrChats } : taskOrChats || {};
    const kind = getNextSitePunchKindForTask(punchSource);
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
    await postSitePunch(detail.id, detail);
  };

  const recordSitePunch = async (t: MobileTaskListItem) => {
    try {
      const full = await taskFetch<Task>(`/task-projects/${t.id}`, user);
      await postSitePunch(t.id, full);
    } catch (e: any) {
      toast.error(e.message || "Could not record site attendance");
    }
  };

  const desktopFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = tasks.filter((t) => {
      const canonical = canonicalTaskStatus(t.status);
      if (statusTab === "Open") return canonical === "Open" || canonical === "Scheduled" || canonical === "Rescheduled";
      if (statusTab === "WIP") return canonical === "Work in Progress" || canonical === "On-Hold";
      if (statusTab === "Closed") return canonical === "Completed";
      return canonical === "Reopen";
    });
    if (!q) return list;
    return list.filter(
      (t) =>
        t.taskName.toLowerCase().includes(q) ||
        String(t.id).includes(q) ||
        t.taskCode.toLowerCase().includes(q) ||
        (t.customer?.customerName || "").toLowerCase().includes(q) ||
        (t.site?.branchName || "").toLowerCase().includes(q),
    );
  }, [tasks, searchQuery, statusTab]);

  const chatView = detail ? (
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
      onSitePunch={isSitePunchTaskType(detail.taskType) ? sitePunch : undefined}
      sitePunchNextKind={getNextSitePunchKindForTask(detail)}
      embedded={isDesktop}
      onDownloadReport={async () => {
        try {
          await downloadTaskReportForId(detail.id, user, detail.taskCode);
          toast.success("Report downloaded");
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : "Failed to download report");
        }
      }}
    />
  ) : null;

  if (detail && !isDesktop) {
    return <EmpMobileLayout hideBottomNav>{chatView}</EmpMobileLayout>;
  }

  if (detail && isDesktop) {
    return (
      <EmpDesktopPage title="Task" description={detail.taskName} icon={ListTodo}>
        {chatView}
      </EmpDesktopPage>
    );
  }

  const createSheet = (
    <MobileTaskCreateSheet
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      user={user}
      creatorEmp={creatorEmp}
      onCreated={() => load()}
    />
  );

  if (isDesktop) {
    return (
      <EmpDesktopPage
        title="Tasks"
        description={isManagerView ? "Team member tasks" : "Assigned tasks"}
        icon={ListTodo}
        actions={
          canCreateTask && !createOpen ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create task
            </Button>
          ) : undefined
        }
      >
        <FormModal
          open={createOpen}
          onOpenChange={(open) => {
            if (!open) setCreateOpen(false);
          }}
          title="New task"
          description="Add details and assign team members."
          showCloseButton
          closeLabel="Close"
        >
          <MobileTaskCreateSheet
            layout="form"
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            user={user}
            creatorEmp={creatorEmp}
            onCreated={() => {
              setCreateOpen(false);
              load();
            }}
          />
        </FormModal>
        {!createOpen ? (
          <EmpTeamStyleDataSection
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search tasks…"
            showViewToggle={false}
            filterContent={STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                  statusTab === tab
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {tab}
              </button>
            ))}
            loading={false}
            empty={false}
            emptyMessage="No tasks in this view"
            listContent={
              <EmpDesktopTaskTable
                tasks={desktopFiltered}
                loading={loading}
                onOpen={(t) => void openTask(t as Task)}
                onSitePunch={(t) => void recordSitePunch(t)}
              />
            }
          />
        ) : null}
      </EmpDesktopPage>
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
        onCheckInOut={(t) => void recordSitePunch(t)}
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
              {isSitePunchTaskType(infoTask.taskType) && (
                <p><span className="text-gray-500">Site:</span> {infoTask.site?.branchName || "—"}</p>
              )}
              {isSitePunchTaskType(infoTask.taskType) && (
                <div className="pt-2 space-y-1">
                  <p className="text-gray-500 font-semibold">Site check-in / check-out</p>
                  {sitePunchesFromTask(infoTask).length === 0 ? (
                    <p className="text-gray-400">No site check-in yet</p>
                  ) : (
                    sitePunchesFromTask(infoTask).map((p, i) => (
                      <p key={`${p.kind}-${p.at}-${i}`}>
                        {p.kind === "in" ? "Site check in" : "Site check out"}: {formatSitePunchAt(p.at)}
                        {p.employeeName ? ` · ${p.employeeName}` : ""}
                      </p>
                    ))
                  )}
                </div>
              )}
            </div>
            <button type="button" className="mt-4 w-full py-2.5 rounded-xl bg-[#2563eb] text-white font-semibold text-sm" onClick={() => { setInfoTask(null); openTask(infoTask); }}>
              Open chat
            </button>
          </div>
        </>
      )}
      {createSheet}
    </EmpMobileLayout>
  );
}
