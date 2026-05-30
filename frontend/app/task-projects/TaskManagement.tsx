"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { FormDrawer } from "../components/ui/form-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Filter, MessageCircle, Pencil, Plus, Search, Trash2, Eye, AlertTriangle, UserPlus } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { taskFetch } from "../utils/taskApi";
import { NEXT_TASK_STATUS } from "../utils/taskStatusFlow";
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { TaskDetailTabs } from "../components/task/TaskDetailTabs";
import { TaskDetailSidebar } from "../components/task/TaskDetailSidebar";
import { TaskRemarksChatbox } from "../components/task/TaskRemarksChatbox";
import {
  TASK_STATUSES,
  TaskBoardSkeleton,
  TaskStatusBadge,
  formatTaskDate,
  type TaskStatus,
} from "../components/task/task-ui";

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

interface Dept { id: number; departmentName?: string | null; }
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
  const canManage = user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
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
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    if (filterOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  const activeFilterCount = [statusFilter, priorityFilter, taskTypeFilter].filter(Boolean).length;

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
      const depts = await fetch("/backend/departments").then((r) => r.json());
      const list: Dept[] = Array.isArray(depts) ? depts : [];
      const term = q.trim().toLowerCase();
      return list.filter((d) => !term || (d.departmentName || "").toLowerCase().includes(term))
        .slice(0, 20).map((d) => ({ ...d, label: d.departmentName || `Dept #${d.id}` }));
    } catch { return []; }
  }, []);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200, search };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (taskTypeFilter) params.taskType = taskTypeFilter;
      const data = await taskFetch<{ items: Task[] }>("/task-projects", user, undefined, params);
      setTasks(data.items);
    } catch (e: any) { toast.error(e.message || "Failed to load tasks"); }
    finally { setLoading(false); }
  }, [user, search, statusFilter, priorityFilter, taskTypeFilter]);

  useEffect(() => { if (user) loadTasks(); }, [user, loadTasks]);

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
    } catch (e: any) { toast.error(e.message); }
    finally { setAssignSaving(false); }
  };

  const openDetail = async (t: Task) => {
    try { const full = await taskFetch<Task>(`/task-projects/${t.id}`, user); setDetail(full); setDetailOpen(true); }
    catch (e: any) { toast.error(e.message); }
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
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const removeTask = async (id: number) => {
    if (!confirm("Delete this task?")) return;
    try {
      await taskFetch(`/task-projects/${id}`, user, { method: "DELETE" });
      toast.success("Task deleted");
      if (chatTask?.id === id) { setChatOpen(false); setChatTask(null); }
      loadTasks();
    } catch (err: any) { toast.error(err.message); }
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

  if (!user) return <div className="p-6"><TaskBoardSkeleton /></div>;
  if (!canManage) return <div className="p-6 text-gray-500">Access denied. Use My Tasks on mobile for assigned tasks.</div>;

  return (
    <div className="space-y-4">
      {!formOpen && !detailOpen && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => { resetForm(); setFormOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Create Task
            </Button>
            <div className="relative" ref={filterRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterOpen((v) => !v)}
                className={activeFilterCount > 0 ? "border-blue-400 bg-blue-50" : ""}
              >
                <Filter className="w-4 h-4 mr-1" /> Filter
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              {filterOpen && (
                <div className="absolute left-0 top-full mt-1 z-30 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-900">Filter Tasks</p>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Status</Label>
                    <select
                      className="app-select w-full h-9 text-sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s === "Closed" ? "Completed" : s === "WIP" ? "Work In Progress" : s === "Reopen" ? "Reopened" : s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Priority</Label>
                    <select
                      className="app-select w-full h-9 text-sm"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                    >
                      <option value="">All priorities</option>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Task Type</Label>
                    <select
                      className="app-select w-full h-9 text-sm"
                      value={taskTypeFilter}
                      onChange={(e) => setTaskTypeFilter(e.target.value)}
                    >
                      <option value="">All types</option>
                      {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setStatusFilter(""); setPriorityFilter(""); setTaskTypeFilter(""); setFilterOpen(false); }}
                    >
                      Clear
                    </Button>
                    <Button type="button" size="sm" className="flex-1" onClick={() => setFilterOpen(false)}>
                      Apply
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {[
              { label: "Completed", status: "Closed", value: stats.Closed, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Open", status: "Open", value: stats.Open, cls: "bg-slate-50 text-slate-700 border-slate-200" },
              { label: "Work In Progress", status: "WIP", value: stats.WIP, cls: "bg-amber-50 text-amber-800 border-amber-200" },
              { label: "Reopened", status: "Reopen", value: stats.Reopen, cls: "bg-violet-50 text-violet-800 border-violet-200" },
            ].map((s) => (
              <button key={s.status} type="button"
                onClick={() => setStatusFilter(statusFilter === s.status ? "" : s.status)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${s.cls} ${statusFilter === s.status ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}>
                {s.label} <span className="font-bold">{s.value}</span>
              </button>
            ))}
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9 h-9" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? <TaskBoardSkeleton /> : (
            <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    {["Task ID", "Department", "Customer", "Site", "Engineer", "Status", "Created At", "Updated At", "Actions"].map((h) => (
                      <TableHead key={h} className={`text-[11px] uppercase tracking-wide font-semibold text-gray-500 ${h === "Actions" ? "text-right" : ""}`}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-400">No tasks found</TableCell></TableRow>
                  ) : tasks.map((t) => {
                    const overdue = isOverdue24h(t);
                    const overdueHours = overdue ? Math.floor((Date.now() - getLastActivityTime(t)) / (1000 * 60 * 60)) : 0;
                    return (
                      <TableRow key={t.id} className={overdue ? "bg-red-50/70 border-l-4 border-l-red-500" : ""}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            <span className={overdue ? "text-red-700 font-semibold" : ""}>{t.taskCode}</span>
                          </div>
                          {overdue && <span className="text-[10px] text-red-500 font-medium">{t.status} &gt; {overdueHours}h</span>}
                        </TableCell>
                        <TableCell className="text-sm">{t.department?.departmentName || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[160px]"><div className="line-clamp-2">{t.customer?.customerName || "—"}</div></TableCell>
                        <TableCell className="text-sm">{t.site?.branchName || "—"}</TableCell>
                        <TableCell className="text-sm">{engineerNames(t)}</TableCell>
                        <TableCell><TaskStatusBadge status={t.status} size="xs" /></TableCell>
                        <TableCell className="text-xs text-gray-500 whitespace-nowrap">{formatTaskDate(t.createdAt)}</TableCell>
                        <TableCell className="text-xs text-gray-500 whitespace-nowrap">{formatTaskDate(t.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => openDetail(t)} title="View"><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => openEdit(t)} title="Edit"><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-600" onClick={() => openAssign(t)} title="Assign Employees"><UserPlus className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => openChat(t)} title="Remarks"><MessageCircle className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeTask(t.id)} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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
        title={detail?.taskName || "Task Details"} description={detail?.taskCode} showHeaderCancel>
        {detail && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4 min-w-0">
              {detail.description && (
                <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1.5">Description</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}
              <TaskDetailTabs key={detail.id} chats={detail.chats || []} activities={detail.activities || []}
                currentUserName={user?.username} message="" onMessageChange={() => {}} onSend={() => {}} showComposer={false} />
            </div>
            <div className="lg:col-span-1">
              <TaskDetailSidebar status={detail.status} priority={detail.priority} taskType={detail.taskType}
                department={detail.department?.departmentName} customer={detail.customer?.customerName}
                branch={detail.site?.branchName} schedule={formatTaskDate(detail.scheduleDateTime)}
                due={formatTaskDate(detail.dueDateTime)} assignments={detail.assignments} />
            </div>
          </div>
        )}
      </FormDrawer>

      {chatTask && (
        <TaskRemarksChatbox open={chatOpen} onClose={() => { setChatOpen(false); setChatTask(null); }}
          taskCode={chatTask.taskCode} status={chatTask.status}
          chats={chatTask.chats || []} activities={chatTask.activities || []}
          message={chatMsg} onMessageChange={setChatMsg}
          statusValue={chatStatus} onStatusChange={setChatStatus}
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
