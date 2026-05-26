"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { FormDrawer } from "../components/ui/form-drawer";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { taskFetch } from "../utils/taskApi";
import { TaskDetailTabs } from "../components/task/TaskDetailTabs";
import { TaskDetailSidebar } from "../components/task/TaskDetailSidebar";
import {
  DesktopTaskCard,
  KanbanColumn,
  TASK_STATUSES,
  TaskBoardSkeleton,
  TaskStatusBadge,
  formatTaskDate,
  PriorityBadge,
  type TaskStatus,
} from "../components/task/task-ui";

const STATUS_CHANGE_OPTIONS: TaskStatus[] = ["WIP", "Closed"];
const STATUSES = TASK_STATUSES;
const PRIORITIES = ["Urgent", "Medium", "Low"];
const TASK_TYPES = ["Site Visit", "Meeting", "Job / Work Task"];

interface Task {
  id: number;
  taskCode: string;
  taskName: string;
  taskType: string;
  status: string;
  priority: string;
  scheduleDateTime?: string | null;
  dueDateTime?: string | null;
  description?: string | null;
  departmentID?: number | null;
  customerID?: number | null;
  siteID?: number | null;
  department?: { id: number; departmentName?: string | null };
  customer?: { id: number; customerCode: string; customerName: string };
  site?: { id: number; branchName: string };
  assignments?: { manageEmployeeID: number; manageEmployee?: { employeeFirstName?: string; employeeLastName?: string } }[];
  chats?: { id: number; message: string; senderName?: string; createdAt: string }[];
  activities?: { id: number; action: string; oldValue?: string; newValue?: string; remark?: string; actorName?: string; createdAt: string }[];
}

interface Dept { id: number; departmentName?: string | null; }
interface Customer { id: number; customerCode: string; customerName: string; }
interface Site { id: number; branchName: string; }
interface Employee { id: number; employeeFirstName?: string; employeeLastName?: string; employeeID?: string; }

export default function TaskManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Task | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatStatus, setChatStatus] = useState("");
  const [chatPriority, setChatPriority] = useState("");
  const [chatRemark, setChatRemark] = useState("");
  const [form, setForm] = useState({
    departmentID: "",
    taskType: "Site Visit",
    customerID: "",
    siteID: "",
    taskName: "",
    description: "",
    scheduleDateTime: "",
    priority: "Medium",
    dueDateTime: "",
    assignedEmployeeIds: [] as number[],
  });

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await taskFetch<{ items: Task[] }>("/task-projects", user, undefined, { limit: 200, search });
      setTasks(data.items);
    } catch (e: any) {
      toast.error(e.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [user, search]);

  const loadMeta = useCallback(async () => {
    if (!user) return;
    try {
      const [depts, custs] = await Promise.all([
        fetch("/backend/departments").then((r) => r.json()),
        canManage ? taskFetch<Customer[]>("/task-customers/dropdown", user) : Promise.resolve([]),
      ]);
      setDepartments(Array.isArray(depts) ? depts : []);
      setCustomers(custs);
    } catch { /* ignore */ }
  }, [user, canManage]);

  useEffect(() => {
    if (!user) return;
    loadTasks();
    loadMeta();
  }, [user, loadTasks, loadMeta]);

  useEffect(() => {
    if (!form.customerID) { setSites([]); return; }
    taskFetch<Site[]>(`/task-customer-sites/by-customer/${form.customerID}`, user).then(setSites).catch(() => setSites([]));
  }, [form.customerID, user]);

  useEffect(() => {
    if (!form.departmentID) { setEmployees([]); return; }
    taskFetch<Employee[]>(`/task-projects/employees-by-department/${form.departmentID}`, user).then(setEmployees).catch(() => setEmployees([]));
  }, [form.departmentID, user]);

  const grouped = useMemo(() => {
    const g: Record<string, Task[]> = { Open: [], WIP: [], Closed: [] };
    tasks.forEach((t) => {
      const s = STATUSES.includes(t.status as TaskStatus) ? t.status : "Open";
      g[s].push(t);
    });
    return g;
  }, [tasks]);

  const stats = useMemo(() => ({
    total: tasks.length,
    open: grouped.Open.length,
    wip: grouped.WIP.length,
    closed: grouped.Closed.length,
  }), [tasks.length, grouped]);

  const openDetail = async (t: Task) => {
    try {
      const full = await taskFetch<Task>(`/task-projects/${t.id}`, user);
      setDetail(full);
      setDetailOpen(true);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.taskName.trim()) { toast.error("Task name required"); return; }
    setSaving(true);
    try {
      await taskFetch("/task-projects", user, {
        method: "POST",
        body: JSON.stringify({
          departmentID: form.departmentID ? Number(form.departmentID) : undefined,
          taskType: form.taskType,
          customerID: form.customerID ? Number(form.customerID) : undefined,
          siteID: form.siteID ? Number(form.siteID) : undefined,
          taskName: form.taskName,
          description: form.description,
          scheduleDateTime: form.scheduleDateTime || undefined,
          priority: form.priority,
          dueDateTime: form.dueDateTime || undefined,
          assignedEmployeeIds: form.assignedEmployeeIds,
        }),
      });
      toast.success("Task created");
      setFormOpen(false);
      loadTasks();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const sendChat = async () => {
    if (!detail || !chatMsg.trim()) return;
    try {
      await taskFetch(`/task-projects/${detail.id}/chats`, user, {
        method: "POST",
        body: JSON.stringify({
          message: chatMsg,
          senderName: user?.username,
          status: chatStatus || undefined,
          priority: chatPriority || undefined,
          remark: chatRemark || undefined,
        }),
      });
      setChatMsg("");
      setChatStatus("");
      setChatPriority("");
      setChatRemark("");
      openDetail(detail);
      loadTasks();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleAssignee = (id: number) => {
    setForm((p) => ({
      ...p,
      assignedEmployeeIds: p.assignedEmployeeIds.includes(id)
        ? p.assignedEmployeeIds.filter((x) => x !== id)
        : [...p.assignedEmployeeIds, id],
    }));
  };

  const closePanels = () => {
    setFormOpen(false);
    setDetailOpen(false);
    setDetail(null);
  };

  if (!user) {
    return <div className="p-6"><TaskBoardSkeleton /></div>;
  }

  if (!canManage) {
    return <div className="p-6 text-gray-500">Access denied. Use My Tasks on mobile for assigned tasks.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!formOpen && !detailOpen && (
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Total", value: stats.total, cls: "bg-gray-50 text-gray-700 border-gray-200" },
              { label: "Open", value: stats.open, cls: "bg-[#eef2ff] text-[#4338ca] border-[#e0e7ff]" },
              { label: "WIP", value: stats.wip, cls: "bg-[#fffbeb] text-[#b45309] border-[#fef3c7]" },
              { label: "Closed", value: stats.closed, cls: "bg-[#ecfdf5] text-[#047857] border-[#d1fae5]" },
            ].map((s) => (
              <span key={s.label} className={`text-[11px] font-medium px-2.5 py-1 rounded-md border ${s.cls}`}>
                {s.label} <span className="font-semibold tabular-nums">{s.value}</span>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {!formOpen && !detailOpen && (
            <>
              <div className="relative hidden sm:block w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  className="pl-8 h-9 text-[13px] bg-white"
                  placeholder="Search tasks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" onClick={() => setViewMode("kanban")}>
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
                <List className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> New Task
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Board / List */}
      {!formOpen && !detailOpen && (
        <>
          <div className="relative sm:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pl-10 bg-white" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <TaskBoardSkeleton />
          ) : viewMode === "kanban" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {STATUSES.map((status) => (
                <KanbanColumn key={status} status={status} count={grouped[status]?.length || 0}>
                  {(grouped[status] || []).map((t) => (
                    <DesktopTaskCard key={t.id} task={{ ...t, status: t.status }} onClick={() => openDetail(t)} />
                  ))}
                </KanbanColumn>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {tasks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">No tasks found</p>
              ) : tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openDetail(t)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50/80 transition-colors border-b border-gray-50 last:border-0 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-[13px] text-gray-900">{t.taskName}</p>
                      <TaskStatusBadge status={t.status} size="xs" />
                      <PriorityBadge priority={t.priority} size="xs" />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {t.taskCode} · {t.taskType}
                      {t.customer?.customerName ? ` · ${t.customer.customerName}` : ""}
                      {t.dueDateTime ? ` · Due ${formatTaskDate(t.dueDateTime)}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create form */}
      <FormDrawer open={formOpen} onOpenChange={setFormOpen} title="Create Task" showHeaderCancel>
        <form onSubmit={submitTask} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <select className="app-select w-full" value={form.departmentID} onChange={(e) => setForm((p) => ({ ...p, departmentID: e.target.value, assignedEmployeeIds: [] }))}>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.departmentName}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Task Type</Label>
              <select className="app-select w-full" value={form.taskType} onChange={(e) => setForm((p) => ({ ...p, taskType: e.target.value }))}>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <select className="app-select w-full" value={form.customerID} onChange={(e) => setForm((p) => ({ ...p, customerID: e.target.value, siteID: "" }))}>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <select className="app-select w-full" value={form.siteID} onChange={(e) => setForm((p) => ({ ...p, siteID: e.target.value }))} disabled={!form.customerID}>
                <option value="">Select branch</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.branchName}</option>)}
              </select>
            </div>
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
          {employees.length > 0 && (
            <div className="space-y-2">
              <Label>Assign Employees</Label>
              <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-gray-50/30">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={form.assignedEmployeeIds.includes(emp.id)} onChange={() => toggleAssignee(emp.id)} />
                    {[emp.employeeFirstName, emp.employeeLastName].filter(Boolean).join(" ")} ({emp.employeeID})
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Task"}</Button>
          </div>
        </form>
      </FormDrawer>

      {/* Task detail — 2-column layout */}
      <FormDrawer
        open={detailOpen}
        onOpenChange={(v) => { if (!v) closePanels(); else setDetailOpen(true); }}
        title={detail?.taskName || "Task Details"}
        description={detail?.taskCode}
        showHeaderCancel
      >
        {detail && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4 min-w-0">
              {detail.description && (
                <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1.5">Description</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}

              <TaskDetailTabs
                key={detail.id}
                chats={detail.chats || []}
                activities={detail.activities || []}
                currentUserName={user?.username}
                message={chatMsg}
                onMessageChange={setChatMsg}
                onSend={sendChat}
                placeholder="Write a reply…"
                footer={
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-1">
                    <select className="app-select w-full h-9 text-[12px]" value={chatStatus} onChange={(e) => setChatStatus(e.target.value)}>
                      <option value="">Update status (optional)</option>
                      {STATUS_CHANGE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="app-select w-full h-9 text-[12px]" value={chatPriority} onChange={(e) => setChatPriority(e.target.value)}>
                      <option value="">Update priority (optional)</option>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <Input placeholder="Optional remark" value={chatRemark} onChange={(e) => setChatRemark(e.target.value)} className="sm:col-span-2 h-9 text-[12px]" />
                  </div>
                }
              />
            </div>

            <div className="lg:col-span-1">
              <TaskDetailSidebar
                status={detail.status}
                priority={detail.priority}
                taskType={detail.taskType}
                department={detail.department?.departmentName}
                customer={detail.customer?.customerName}
                branch={detail.site?.branchName}
                schedule={formatTaskDate(detail.scheduleDateTime)}
                due={formatTaskDate(detail.dueDateTime)}
                assignments={detail.assignments}
              />
            </div>
          </div>
        )}
      </FormDrawer>
    </div>
  );
}
