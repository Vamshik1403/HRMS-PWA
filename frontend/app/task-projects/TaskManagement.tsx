"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { FormDrawer } from "../components/ui/form-drawer";
import { DetailCard } from "../components/app/detail-card";
import { EntityDetailHero, EntityDetailLayout } from "../components/app/entity-detail-layout";
import { MessageCircle, Plus, AlertTriangle, UserPlus, FileDown, ClipboardList } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { isDesktopManagerFlagSet } from "@/lib/desktopManager";
import { hasModuleWriteAccess, canViewModule } from "@/lib/companyAccess";
import { toast } from "sonner";
import { taskFetch } from "../utils/taskApi";
import { NEXT_TASK_STATUS } from "../utils/taskStatusFlow";
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { TaskDetailTabs } from "../components/task/TaskDetailTabs";
import { TaskRemarksChatbox } from "../components/task/TaskRemarksChatbox";
import {
  TASK_STATUSES,
  TaskBoardSkeleton,
  TaskStatusBadge,
  formatTaskDate,
  type TaskStatus,
} from "../components/task/task-ui";
import { downloadTaskReportForId } from "../utils/taskReportPdf";
import { dispatchAppRefresh } from "../utils/appRefresh";
import { useAppRefresh } from "../hooks/useAppRefresh";
import { useTaskChatPolling } from "../hooks/useTaskChatPolling";
import { getSidebarContext } from "../utils/sidebarContext";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { useClientTable, sortRows } from "../hooks/use-client-table";

const STATUSES = TASK_STATUSES;
const PRIORITIES = ["Urgent", "Medium", "Low"];
const TASK_TYPES = ["Site Visit", "Meeting", "Job / Work Task"];

interface Task {
  id: number; taskCode: string; taskName: string; taskType: string;
  status: string; priority: string;
  scheduleDateTime?: string | null; dueDateTime?: string | null;
  description?: string | null;
  departmentID?: number | null; customerID?: number | null; siteID?: number | null;
  createdAt?: string; updatedAt?: string;
  department?: { id: number; departmentName?: string | null };
  customer?: { id: number; customerCode: string; customerName: string };
  site?: { id: number; branchName: string };
  assignments?: { manageEmployeeID: number; manageEmployee?: { employeeFirstName?: string; employeeLastName?: string } }[];
  chats?: { id: number; message: string; senderName?: string; attachmentUrl?: string | null; createdAt: string }[];
  activities?: { id: number; action: string; oldValue?: string; newValue?: string; remark?: string; actorName?: string; createdAt: string }[];
}

interface Dept {
  id: number;
  departmentName?: string | null;
  companyID?: number | null;
  serviceProviderID?: number | null;
}

interface Employee { id: number; employeeFirstName?: string; employeeLastName?: string; employeeID?: string; }

function engineerNames(task: Task) {
  const names = (task.assignments || [])
    .map((a) => [a.manageEmployee?.employeeFirstName, a.manageEmployee?.employeeLastName].filter(Boolean).join(" "))
    .filter(Boolean);
  return names.length ? names.join(", ") : "N/A";
}

function getLastActivityTime(task: Task): number {
  // Use the most recent chat timestamp, falling back to updatedAt, then createdAt
  const lastChat = task.chats?.[0]?.createdAt;
  if (lastChat) return new Date(lastChat).getTime();
  if (task.updatedAt) return new Date(task.updatedAt).getTime();
  if (task.createdAt) return new Date(task.createdAt).getTime();
  return 0;
}

function isOverdue24h(task: Task) {
  if (task.status === "Closed" || task.status === "Reopen") return false;
  const last = getLastActivityTime(task);
  if (!last) return false;
  return (Date.now() - last) / (1000 * 60 * 60) > 24;
}

export default function TaskManagement() {
  const user = useCurrentUser();
  const desktopManager =
    user?.role === "EMPLOYEE" && isDesktopManagerFlagSet();
  const canManage =
    user?.role === "SUPERADMIN" ||
    user?.role === "COMPANY_ADMIN" ||
    desktopManager ||
    hasModuleWriteAccess("TASKS");
  const canView =
    canManage ||
    user?.role === "SUPERADMIN" ||
    user?.role === "COMPANY_ADMIN" ||
    canViewModule("TASKS");
  const table = useClientTable("taskCode");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [taskTypeFilter, setTaskTypeFilter] = useState("ALL");
  const customerIdRef = useRef("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTask, setChatTask] = useState<Task | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [chatStatus, setChatStatus] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [detailChatMsg, setDetailChatMsg] = useState("");
  const [detailChatSending, setDetailChatSending] = useState(false);
  // Assign employees modal
  const [assignTask, setAssignTask] = useState<Task | null>(null);
  const [assignEmployees, setAssignEmployees] = useState<Employee[]>([]);
  const [assignIds, setAssignIds] = useState<number[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [form, setForm] = useState({
    departmentID: "", taskType: "Site Visit", customerID: "", siteID: "",
    taskName: "", description: "", scheduleDateTime: "", priority: "Medium",
    dueDateTime: "",
  });
  const [customerLabel, setCustomerLabel] = useState("");
  const [branchLabel, setBranchLabel] = useState("");
  const [departmentLabel, setDepartmentLabel] = useState("");

  useEffect(() => {
    customerIdRef.current = form.customerID;
  }, [form.customerID]);


  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(table.search), 300);
    return () => clearTimeout(t);
  }, [table.search]);

  const searchCustomers = useCallback(async (q: string) => {
    const data = await taskFetch<any[]>("/task-customers/dropdown", user, undefined, { q, limit: 20 });
    return data.map((c) => ({ ...c, label: `${c.customerCode} — ${c.customerName}` }));
  }, [user]);

  const searchBranches = useCallback(async (q: string) => {
    const params: Record<string, string | number> = { q, limit: 20 };
    if (customerIdRef.current) params.customerID = customerIdRef.current;
    const data = await taskFetch<any[]>("/task-customer-sites/dropdown", user, undefined, params);
    return data.map((s) => ({
      ...s,
      label: s.customer?.customerName
        ? `${s.branchName} — ${s.customer.customerName}`
        : s.branchName,
    }));
  }, [user]);

const searchDepartments = useCallback(async (q: string) => {
  try {
    const depts = await fetch("/backend/departments", { cache: "no-store" }).then((r) => r.json());
    let list: Dept[] = Array.isArray(depts) ? depts : [];

    const ctx = getSidebarContext();

    const activeCompanyID =
      ctx?.companyID ??
      user?.companyID ??
      null;

    if (activeCompanyID) {
      list = list.filter(
        (d: any) => Number(d.companyID) === Number(activeCompanyID)
      );
    }

    const term = q.trim().toLowerCase();

    return list
      .filter((d) => !term || (d.departmentName || "").toLowerCase().includes(term))
      .slice(0, 20)
      .map((d) => ({
        ...d,
        label: d.departmentName || `Dept #${d.id}`,
      }));
  } catch {
    return [];
  }
}, [user?.companyID]);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200, search: debouncedSearch };
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (priorityFilter !== "ALL") params.priority = priorityFilter;
      if (taskTypeFilter !== "ALL") params.taskType = taskTypeFilter;
      const data = await taskFetch<{ items: Task[] }>("/task-projects", user, undefined, params);
      setTasks(data.items);
    } catch (e: any) { toast.error(e.message || "Failed to load tasks"); }
    finally { setLoading(false); }
  }, [user, debouncedSearch, statusFilter, priorityFilter, taskTypeFilter]);

useEffect(() => {
  const load = () => {
    if (user) loadTasks();
  };

  load();

  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/task-projects") {
      closeTaskPagePanels();
      load();
    }
  };

const sidebarCompanyChangeHandler = () => {
  setForm((p) => ({
    ...p,
    departmentID: "",
    siteID: "",
    customerID: "",
  }));

  customerIdRef.current = "";
  setDepartmentLabel("");
  setCustomerLabel("");
  setBranchLabel("");

  load();
};

window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler);
window.addEventListener("sidebar-context-changed", sidebarCompanyChangeHandler);
window.addEventListener("app-data-refresh", sidebarCompanyChangeHandler);

return () => {
  window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler);
  window.removeEventListener("sidebar-context-changed", sidebarCompanyChangeHandler);
  window.removeEventListener("app-data-refresh", sidebarCompanyChangeHandler);
};
}, [user, loadTasks]);

useAppRefresh(() => {
  if (user) loadTasks();
}, [user, loadTasks]);


  const downloadReport = async (t: Task) => {
    try {
      const tid = toast.loading("Generating report…");
      await downloadTaskReportForId(t.id, user, t.taskCode);
      toast.dismiss(tid);
      toast.success("Report downloaded");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to download report");
    }
  };

  // Load employees for assign modal based on task's department
  useEffect(() => {
    if (!assignTask?.departmentID) { setAssignEmployees([]); return; }
    taskFetch<Employee[]>(`/task-projects/employees-by-department/${assignTask.departmentID}`, user)
      .then(setAssignEmployees).catch(() => setAssignEmployees([]));
  }, [assignTask, user]);

  const stats = useMemo(() => {
    const g = { Open: 0, WIP: 0, Closed: 0, Reopen: 0 };
    tasks.forEach((t) => {
      if (t.status === "Open") g.Open++;
      else if (t.status === "WIP") g.WIP++;
      else if (t.status === "Closed") g.Closed++;
      else if (t.status === "Reopen") g.Reopen++;
    });
    return { total: tasks.length, Open: g.Open, WIP: g.WIP, Closed: g.Closed, Reopen: g.Reopen };
  }, [tasks]);

  const resetForm = () => {
    setForm({ departmentID: "", taskType: "Site Visit", customerID: "", siteID: "", taskName: "", description: "", scheduleDateTime: "", priority: "Medium", dueDateTime: "" });
    customerIdRef.current = "";
    setCustomerLabel(""); setBranchLabel(""); setDepartmentLabel(""); setEditingTask(null);
  };

 const closeTaskPagePanels = () => {
  resetForm();

  setFormOpen(false);
  setEditingTask(null);

  setDetailOpen(false);
  setDetail(null);

  setChatOpen(false);
  setChatTask(null);
  setChatMsg("");

};

  const openAssign = async (t: Task) => {
    const full = await taskFetch<Task>(`/task-projects/${t.id}`, user).catch(() => t);
    setAssignTask(full);
    setAssignIds((full.assignments || []).map((a) => a.manageEmployeeID));
  };

  const saveAssign = async () => {
    if (!assignTask) return;
    setAssignSaving(true);
    try {
      await taskFetch(`/task-projects/${assignTask.id}/assign`, user, {
        method: "PATCH",
        body: JSON.stringify({ assignedEmployeeIds: assignIds }),
      });
      toast.success("Employees assigned");
      setAssignTask(null);
      loadTasks();
      dispatchAppRefresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setAssignSaving(false); }
  };

  const openDetail = async (t: Task) => {
    try {
      const full = await taskFetch<Task>(`/task-projects/${t.id}`, user);
      setDetail(full);
      setDetailChatMsg("");
      setDetailOpen(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = async (t: Task) => {
    try {
      const full = await taskFetch<Task>(`/task-projects/${t.id}`, user);
      setEditingTask(full);
      setForm({
        departmentID: full.departmentID ? String(full.departmentID) : "",
        taskType: full.taskType, customerID: full.customerID ? String(full.customerID) : "",
        siteID: full.siteID ? String(full.siteID) : "", taskName: full.taskName,
        description: full.description || "",
        scheduleDateTime: full.scheduleDateTime ? full.scheduleDateTime.slice(0, 16) : "",
        priority: full.priority,
        dueDateTime: full.dueDateTime ? full.dueDateTime.slice(0, 16) : "",
      });
      setCustomerLabel(full.customer ? `${full.customer.customerCode} — ${full.customer.customerName}` : "");
      customerIdRef.current = full.customerID ? String(full.customerID) : "";
      setBranchLabel(full.site?.branchName || "");
      setDepartmentLabel(full.department?.departmentName || "");
      setFormOpen(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const openChat = async (t: Task) => {
    try {
      const full = await taskFetch<Task>(`/task-projects/${t.id}`, user);
      setChatTask(full); setChatStatus(full.status); setChatMsg(""); setChatOpen(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.taskName.trim()) { toast.error("Task name required"); return; }
    setSaving(true);
    const payload = {
      departmentID: form.departmentID ? Number(form.departmentID) : undefined,
      taskType: form.taskType,
      customerID: form.customerID ? Number(form.customerID) : undefined,
      siteID: form.siteID ? Number(form.siteID) : undefined,
      taskName: form.taskName, description: form.description,
      scheduleDateTime: form.scheduleDateTime || undefined, priority: form.priority,
      dueDateTime: form.dueDateTime || undefined,
    };
    try {
      if (editingTask) {
        await taskFetch(`/task-projects/${editingTask.id}`, user, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Task updated");
      } else {
        await taskFetch("/task-projects", user, { method: "POST", body: JSON.stringify(payload) });
        toast.success("Task created");
      }
      setFormOpen(false); resetForm(); loadTasks();
      dispatchAppRefresh();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const removeTask = async (id: number) => {
    try {
      await taskFetch(`/task-projects/${id}`, user, { method: "DELETE" });
      toast.success("Task deleted");
      if (chatTask?.id === id) { setChatOpen(false); setChatTask(null); }
      loadTasks();
      dispatchAppRefresh();
    } catch (err: any) { toast.error(err.message); }
  };

  const applyChatStatus = async (next: string) => {
    if (!chatTask) return;
    setChatStatus(next);
    if (next === chatTask.status) return;
    try {
      await taskFetch(`/task-projects/${chatTask.id}/status`, user, {
        method: "PATCH",
        body: JSON.stringify({ status: next, actorName: user?.username }),
      });
      const full = await taskFetch<Task>(`/task-projects/${chatTask.id}`, user);
      setChatTask(full);
      setChatStatus(full.status);
      loadTasks();
      dispatchAppRefresh();
      toast.success(`Status updated to ${next === "WIP" ? "Work In Progress" : next}`);
    } catch (err: any) {
      setChatStatus(chatTask.status);
      toast.error(err.message || "Could not update status");
    }
  };

  const sendChat = async (payload: { message: string; attachmentUrl?: string }) => {
    if (!chatTask) return;
    if (!payload.message.trim() && !payload.attachmentUrl) return;
    setChatSending(true);
    try {
      const newStatus = chatStatus && chatStatus !== chatTask.status ? chatStatus : undefined;
      await taskFetch(`/task-projects/${chatTask.id}/chats`, user, {
        method: "POST",
        body: JSON.stringify({
          message: payload.message,
          attachmentUrl: payload.attachmentUrl,
          senderName: user?.username,
          status: newStatus,
          remark: payload.message || "Image attachment",
        }),
      });
      setChatMsg("");
      const full = await taskFetch<Task>(`/task-projects/${chatTask.id}`, user);
      setChatTask(full); setChatStatus(full.status); loadTasks();
    } catch (err: any) { toast.error(err.message); }
    finally { setChatSending(false); }
  };

  const sendDetailChat = async () => {
    if (!detail || !detailChatMsg.trim()) return;
    setDetailChatSending(true);
    try {
      await taskFetch(`/task-projects/${detail.id}/chats`, user, {
        method: "POST",
        body: JSON.stringify({
          message: detailChatMsg,
          senderName: user?.username,
          remark: detailChatMsg,
        }),
      });
      setDetailChatMsg("");
      const full = await taskFetch<Task>(`/task-projects/${detail.id}`, user);
      setDetail(full);
      loadTasks();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDetailChatSending(false);
    }
  };

  useTaskChatPolling<Task>(
    detail?.id,
    user,
    (full) => {
      if (detailOpen) setDetail(full);
    },
    detailOpen && !!detail,
  );

  useTaskChatPolling<Task>(
    chatTask?.id,
    user,
    (full) => {
      setChatTask((prev) => {
        if (!prev || prev.id !== full.id) {
          setChatStatus(full.status);
          return full;
        }
        setChatStatus((sel) => {
          const pendingLocalStatus = sel !== prev.status;
          if (pendingLocalStatus && full.status === prev.status) return sel;
          return full.status;
        });
        return full;
      });
    },
    chatOpen && !!chatTask,
  );

  const sortedTasks = useMemo(
    () =>
      sortRows(tasks, table.sortBy, table.sortDir, (row, key) => {
        const t = row as Task;
        if (key === "taskCode") return t.taskCode ?? "";
        if (key === "department") return t.department?.departmentName ?? "";
        if (key === "customer") return t.customer?.customerName ?? "";
        if (key === "site") return t.site?.branchName ?? "";
        if (key === "engineer") return engineerNames(t);
        if (key === "status") return t.status ?? "";
        if (key === "createdAt") return t.createdAt ?? "";
        if (key === "updatedAt") return t.updatedAt ?? "";
        return "";
      }),
    [tasks, table.sortBy, table.sortDir],
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All statuses" },
      ...STATUSES.map((s) => ({
        value: s,
        label: s === "Closed" ? "Completed" : s === "WIP" ? "Work In Progress" : s === "Reopen" ? "Reopened" : s,
      })),
    ],
    [],
  );

  const priorityFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All priorities" },
      ...PRIORITIES.map((p) => ({ value: p, label: p })),
    ],
    [],
  );

  const taskTypeFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All types" },
      ...TASK_TYPES.map((t) => ({ value: t, label: t })),
    ],
    [],
  );

  const taskColumns = useMemo((): DataTableColumn<Task>[] => [
    {
      key: "taskCode",
      header: "Task ID",
      sortable: true,
      colSpan: 2,
      cell: (t) => {
        const overdue = isOverdue24h(t);
        const overdueHours = overdue ? Math.floor((Date.now() - getLastActivityTime(t)) / (1000 * 60 * 60)) : 0;
        return (
          <div className="font-mono text-xs whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
              <span className={overdue ? "text-red-700 font-semibold" : ""}>{t.taskCode}</span>
            </div>
            {overdue && (
              <span className="text-[10px] text-red-500 font-medium">
                {t.status} &gt; {overdueHours}h
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      colSpan: 2,
      cell: (t) => <span className="text-sm">{t.department?.departmentName || "—"}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      colSpan: 2,
      cell: (t) => (
        <span className="text-sm line-clamp-2">{t.customer?.customerName || "—"}</span>
      ),
    },
    {
      key: "site",
      header: "Site",
      sortable: true,
      colSpan: 1,
      cell: (t) => <span className="text-sm">{t.site?.branchName || "—"}</span>,
    },
    {
      key: "engineer",
      header: "Engineer",
      sortable: true,
      colSpan: 2,
      cell: (t) => <span className="text-sm">{engineerNames(t)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      colSpan: 1,
      cell: (t) => <TaskStatusBadge status={t.status} size="xs" />,
    },
    {
      key: "createdAt",
      header: "Created At",
      sortable: true,
      colSpan: 1,
      cell: (t) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">{formatTaskDate(t.createdAt)}</span>
      ),
    },
    {
      key: "updatedAt",
      header: "Updated At",
      sortable: true,
      colSpan: 1,
      cell: (t) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">{formatTaskDate(t.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 2,
      align: "right",
      cell: (t) => (
        <EntityRowActions
          onView={() => openDetail(t)}
          onEdit={canManage ? () => openEdit(t) : undefined}
          onDelete={canManage ? () => removeTask(t.id) : undefined}
          extra={[
            ...(canManage
              ? [
                  {
                    icon: UserPlus,
                    title: "Assign Employees",
                    onClick: () => openAssign(t),
                    className: "text-violet-600",
                  },
                ]
              : []),
            {
              icon: MessageCircle,
              title: "Remarks",
              onClick: () => openChat(t),
              className: "text-emerald-600",
            },
            {
              icon: FileDown,
              title: "Download report",
              onClick: () => downloadReport(t),
              className: "text-slate-600",
            },
          ]}
        />
      ),
    },
  ], [canManage]);

  if (!user) return <div className="p-6"><TaskBoardSkeleton /></div>;
  if (!canView) return <div className="p-6 text-gray-500">Access denied. You need Tasks module rights to manage tasks here.</div>;

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      {!formOpen && !detailOpen && (
        <>
          <PageHeader
            icon={ClipboardList}
            title="Tasks / Projects"
            description="Manage tasks and project assignments"
            actions={
              canManage ? (
              <Button
                onClick={() => {
                  closeTaskPagePanels();
                  setFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Create Task
              </Button>
              ) : undefined
            }
          />

          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search tasks…",
            }}
            filters={
              <>
                <FilterSelect
                  id="tasks-status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusFilterOptions}
                  width="w-44"
                  ariaLabel="Filter by status"
                />
                <FilterSelect
                  id="tasks-priority"
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  options={priorityFilterOptions}
                  width="w-40"
                  ariaLabel="Filter by priority"
                />
                <FilterSelect
                  id="tasks-type"
                  value={taskTypeFilter}
                  onChange={setTaskTypeFilter}
                  options={taskTypeFilterOptions}
                  width="w-44"
                  ariaLabel="Filter by task type"
                />
              </>
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Completed", status: "Closed", value: stats.Closed, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Open", status: "Open", value: stats.Open, cls: "bg-slate-50 text-slate-700 border-slate-200" },
              { label: "Work In Progress", status: "WIP", value: stats.WIP, cls: "bg-amber-50 text-amber-800 border-amber-200" },
              { label: "Reopened", status: "Reopen", value: stats.Reopen, cls: "bg-violet-50 text-violet-800 border-violet-200" },
            ].map((s) => (
              <button
                key={s.status}
                type="button"
                onClick={() => setStatusFilter(statusFilter === s.status ? "ALL" : s.status)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${s.cls} ${statusFilter === s.status ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
              >
                {s.label} <span className="font-bold">{s.value}</span>
              </button>
            ))}
          </div>

          <EntityListShell
            title="All tasks"
            totalLabel={() => `${tasks.length} tasks`}
            columns={taskColumns}
            rows={sortedTasks}
            rowKey={(t) => String(t.id)}
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={ClipboardList}
            emptyTitle="No tasks found"
            emptyDescription="Create a task to start tracking work."
            emptyAction={
              <Button
                onClick={() => {
                  closeTaskPagePanels();
                  setFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Create Task
              </Button>
            }
          />
        </>
      )}

      <FormDrawer open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); resetForm(); } }} title={editingTask ? "Edit Task" : "Create Task"} showHeaderCancel>
        <form onSubmit={submitTask} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchSuggestInput label="Department" placeholder="Search department…" value={departmentLabel} onChange={setDepartmentLabel}
              fetchData={searchDepartments} displayField="label" valueField="id"
              onSelect={({ value }) => { setForm((p) => ({ ...p, departmentID: String(value) })); }} />
            <div className="space-y-2">
              <Label>Task Type</Label>
              <select className="app-select w-full" value={form.taskType} onChange={(e) => setForm((p) => ({ ...p, taskType: e.target.value }))}>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchSuggestInput label="Customer" placeholder="Search customer…" value={customerLabel} onChange={setCustomerLabel}
              fetchData={searchCustomers} displayField="label" valueField="id"
              onSelect={({ value }) => {
                customerIdRef.current = String(value);
                setForm((p) => ({ ...p, customerID: String(value), siteID: "" }));
                setBranchLabel("");
              }} />
            <SearchSuggestInput
              key={form.customerID || "all-branches"}
              label="Branch / Site"
              placeholder="Search branch…"
              value={branchLabel}
              onChange={setBranchLabel}
              fetchData={searchBranches}
              displayField="label"
              valueField="id"
              onSelect={({ value, item }) => {
                setForm((p) => ({
                  ...p,
                  siteID: String(value),
                  customerID: item.customerID ? String(item.customerID) : p.customerID,
                }));
                if (item.customer) {
                  customerIdRef.current = String(item.customerID);
                  setCustomerLabel(`${item.customer.customerCode} — ${item.customer.customerName}`);
                }
                setBranchLabel(item.branchName || item.label?.split(" — ")[0] || "");
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Task Name *</Label>
            <Input value={form.taskName} onChange={(e) => setForm((p) => ({ ...p, taskName: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Schedule</Label><Input type="datetime-local" className="cursor-pointer" value={form.scheduleDateTime} onChange={(e) => setForm((p) => ({ ...p, scheduleDateTime: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Due</Label><Input type="datetime-local" className="cursor-pointer" value={form.dueDateTime} onChange={(e) => setForm((p) => ({ ...p, dueDateTime: e.target.value }))} /></div>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <select className="app-select w-full" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingTask ? "Update Task" : "Create Task"}</Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer open={detailOpen} onOpenChange={(v) => { if (!v) { setDetailOpen(false); setDetail(null); } }}
        title="Task Details" showHeaderCancel cancelLabel="Close">
        {detail && (
          <div className="space-y-6">
            <EntityDetailLayout
              hero={
                <EntityDetailHero
                  title={detail.taskName}
                  subtitle={<span>{detail.taskCode}</span>}
                />
              }
            >
              <DetailCard
                title="Overview"
                subtitle="Task classification and status"
                rows={[
                  { label: "Task code", value: detail.taskCode },
                  { label: "Task type", value: detail.taskType },
                  { label: "Status", value: detail.status },
                  { label: "Priority", value: detail.priority },
                ]}
              />
              <DetailCard
                title="Assignment"
                subtitle="Organisation and scheduling"
                rows={[
                  { label: "Department", value: detail.department?.departmentName },
                  { label: "Customer", value: detail.customer?.customerName },
                  { label: "Branch / site", value: detail.site?.branchName },
                  { label: "Schedule", value: formatTaskDate(detail.scheduleDateTime) },
                  { label: "Due date", value: formatTaskDate(detail.dueDateTime) },
                ]}
              />
              {detail.description ? (
                <DetailCard title="Description" subtitle="Task details" className="lg:col-span-2">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{detail.description}</p>
                </DetailCard>
              ) : null}
              <DetailCard title="Assignees" subtitle="Employees assigned to this task" className="lg:col-span-2">
                {(detail.assignments || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                ) : (
                  <div className="divide-y divide-border">
                    {(detail.assignments || []).map((a) => {
                      const name = [a.manageEmployee?.employeeFirstName, a.manageEmployee?.employeeLastName]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <div key={a.manageEmployeeID} className="py-2.5 text-sm font-medium">
                          {name || "Employee"}
                        </div>
                      );
                    })}
                  </div>
                )}
              </DetailCard>
            </EntityDetailLayout>

            <TaskDetailTabs
              key={detail.id}
              chats={detail.chats || []}
              activities={detail.activities || []}
              currentUserName={user?.username}
              message={detailChatMsg}
              onMessageChange={setDetailChatMsg}
              onSend={sendDetailChat}
              sending={detailChatSending}
              showComposer
            />
          </div>
        )}
      </FormDrawer>

      {chatTask && (
        <TaskRemarksChatbox open={chatOpen} onClose={() => { setChatOpen(false); setChatTask(null); }}
          taskCode={chatTask.taskCode} status={chatTask.status}
          chats={chatTask.chats || []} activities={chatTask.activities || []}
          message={chatMsg} onMessageChange={setChatMsg}
          statusValue={chatStatus} onStatusChange={applyChatStatus}
          statusOptions={NEXT_TASK_STATUS[chatTask.status as TaskStatus] ? [NEXT_TASK_STATUS[chatTask.status as TaskStatus]] : []}
          onSend={sendChat} sending={chatSending} />
      )}

      {/* Assign Employees Modal */}
      {assignTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[min(440px,calc(100vw-2rem))] mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">Assign Employees</p>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">{assignTask.taskCode}</p>
              </div>
              <button type="button" onClick={() => setAssignTask(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="px-5 py-4 max-h-72 overflow-y-auto">
              {assignEmployees.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  {assignTask.departmentID ? "No employees in this department" : "No department assigned to this task"}
                </p>
              ) : (
                <div className="space-y-2">
                  {assignEmployees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignIds.includes(emp.id)}
                        onChange={() => setAssignIds((prev) =>
                          prev.includes(emp.id) ? prev.filter((x) => x !== emp.id) : [...prev, emp.id]
                        )}
                        className="w-4 h-4 accent-violet-600"
                      />
                      <span className="text-[13px] text-gray-800">
                        {[emp.employeeFirstName, emp.employeeLastName].filter(Boolean).join(" ")}
                        <span className="text-gray-400 ml-1">({emp.employeeID})</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <Button variant="outline" onClick={() => setAssignTask(null)}>Cancel</Button>
              <Button onClick={saveAssign} disabled={assignSaving} className="bg-violet-600 hover:bg-violet-700">
                {assignSaving ? "Saving…" : "Save Assignment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
