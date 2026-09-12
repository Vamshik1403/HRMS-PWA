"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { taskFetch } from "@/app/utils/taskApi";
import type { CurrentUserLike } from "@/app/utils/taskApi";
import { toast } from "sonner";
import { toIsoFromDatetimeLocal } from "@/app/utils/taskDueAt";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";

const TASK_TYPES = ["Internal Task", "Customer Visit", "SERVICE", "PRODUCT_INQUIRY", "PURCHASE_ORDER"];
const PRIORITIES = ["Urgent", "High", "Medium", "Low"];

type Dept = { id: number; departmentName?: string | null; companyID?: number | null };
type AssignEmployee = {
  id: number;
  employeeID?: string | null;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  companyName?: string | null;
};
type CustomerOpt = { id: number; customerCode?: string; customerName?: string; label?: string };
type SiteOpt = {
  id: number;
  branchName?: string;
  customerID?: number;
  customer?: { customerCode?: string; customerName?: string };
};

export type CreatorEmp = {
  id: number;
  companyID?: number | null;
  departmentNameID?: number | null;
};

export type MobileTaskCreateFormState = {
  departmentID: string;
  taskType: string;
  customerID: string;
  siteID: string;
  taskName: string;
  description: string;
  scheduleDateTime: string;
  dueDateTime: string;
  priority: string;
  assignedEmployeeIds: number[];
};

const fieldClass =
  "w-full min-h-[44px] px-3 py-2 rounded-xl border border-gray-200 text-[15px] bg-white text-gray-900";
const labelClass = "text-xs font-semibold text-gray-600 mb-1 block";

function empLabel(e: AssignEmployee): string {
  const name = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`.trim();
  const base = name ? `${name}${e.employeeID ? ` (${e.employeeID})` : ""}` : e.employeeID || `#${e.id}`;
  return e.companyName ? `${base} · ${e.companyName}` : base;
}

function defaultForm(departmentId?: number | null): MobileTaskCreateFormState {
  return {
    departmentID: departmentId ? String(departmentId) : "",
    taskType: "Internal Task",
    customerID: "",
    siteID: "",
    taskName: "",
    description: "",
    scheduleDateTime: "",
    dueDateTime: "",
    priority: "Medium",
    assignedEmployeeIds: [],
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  user: CurrentUserLike | null | undefined;
  creatorEmp: CreatorEmp | null;
  onCreated: () => void;
  /** Desktop My Tasks uses an in-page form; PWA keeps the bottom sheet. */
  layout?: "sheet" | "form";
};

export function MobileTaskCreateSheet({
  open,
  onClose,
  user,
  creatorEmp,
  onCreated,
  layout = "sheet",
}: Props) {
  const [form, setForm] = useState<MobileTaskCreateFormState>(() =>
    defaultForm(creatorEmp?.departmentNameID),
  );
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [sites, setSites] = useState<SiteOpt[]>([]);
  const [assignEmployees, setAssignEmployees] = useState<AssignEmployee[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [creating, setCreating] = useState(false);

  const isCustomerVisit =
    form.taskType === "Customer Visit" ||
    form.taskType === "SERVICE" ||
    form.taskType === "PRODUCT_INQUIRY" ||
    form.taskType === "PURCHASE_ORDER";

  const reset = useCallback(() => {
    setForm(defaultForm(creatorEmp?.departmentNameID));
    setAssignSearch("");
  }, [creatorEmp?.departmentNameID]);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open || !user) return;
    setLoadingMeta(true);
    Promise.all([
      fetch("/backend/departments", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : [],
      ),
      taskFetch<CustomerOpt[]>("/task-customers/dropdown", user, undefined, {
        q: "",
        limit: 80,
      }).catch(() => []),
    ])
      .then(([depts, custs]) => {
        const list: Dept[] = Array.isArray(depts) ? depts : [];
        const companyId = creatorEmp?.companyID;
        setDepartments(
          companyId
            ? list.filter((d) => !d.companyID || d.companyID === companyId)
            : list,
        );
        setCustomers(Array.isArray(custs) ? custs : []);
      })
      .finally(() => setLoadingMeta(false));
  }, [open, user, creatorEmp?.companyID]);

  useEffect(() => {
    if (!open || !user || !form.customerID) {
      setSites([]);
      return;
    }
    taskFetch<SiteOpt[]>("/task-customer-sites/dropdown", user, undefined, {
      q: "",
      limit: 80,
      customerID: form.customerID,
    })
      .then((data) => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]));
  }, [open, user, form.customerID]);

  useEffect(() => {
    if (!open || !user || !form.departmentID) {
      setAssignEmployees([]);
      return;
    }
    taskFetch<AssignEmployee[]>(
      `/task-projects/employees-by-department/${form.departmentID}`,
      user,
    )
      .then(setAssignEmployees)
      .catch(() => setAssignEmployees([]));
  }, [open, user, form.departmentID]);

  const filteredAssignees = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return assignEmployees;
    return assignEmployees.filter((e) => empLabel(e).toLowerCase().includes(q));
  }, [assignEmployees, assignSearch]);

  const toggleAssignee = (id: number) => {
    setForm((p) => ({
      ...p,
      assignedEmployeeIds: p.assignedEmployeeIds.includes(id)
        ? p.assignedEmployeeIds.filter((x) => x !== id)
        : [...p.assignedEmployeeIds, id],
    }));
  };

  const submit = async () => {
    if (!form.taskName.trim()) {
      toast.error("Title is required");
      return;
    }
    if (form.assignedEmployeeIds.length > 0 && !form.dueDateTime) {
      toast.error("Due date & time is required when an engineer is assigned");
      return;
    }
    if (!user || !creatorEmp) return;
    setCreating(true);
    try {
      const dueIso = toIsoFromDatetimeLocal(form.dueDateTime);
      const payload: Record<string, unknown> = {
        departmentID: form.departmentID ? Number(form.departmentID) : undefined,
        taskType: form.taskType,
        taskName: form.taskName.trim(),
        description: form.description.trim() || undefined,
        scheduleDateTime: form.scheduleDateTime || undefined,
        dueDateTime: dueIso,
        dueAt: dueIso,
        priority: form.priority,
        createdByEmployeeID: creatorEmp.id,
        assignedEmployeeIds:
          form.assignedEmployeeIds.length > 0 ? form.assignedEmployeeIds : undefined,
      };
      if (isCustomerVisit) {
        if (form.customerID) payload.customerID = Number(form.customerID);
        if (form.siteID) payload.siteID = Number(form.siteID);
      }
      await taskFetch("/task-projects", user, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Task created");
      onClose();
      reset();
      onCreated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not create task";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  if (layout === "form") {
    if (!open) return null;
    return (
      <div className="space-y-5">
        {loadingMeta && (
          <p className="text-sm text-muted-foreground">Loading options…</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="desktop-task-title">Title *</Label>
            <Input
              id="desktop-task-title"
              value={form.taskName}
              onChange={(e) => setForm((p) => ({ ...p, taskName: e.target.value }))}
              placeholder="Enter task name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desktop-task-dept">Department</Label>
            <select
              id="desktop-task-dept"
              className="app-select w-full"
              value={form.departmentID}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  departmentID: e.target.value,
                  assignedEmployeeIds: [],
                }))
              }
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.departmentName || `Department #${d.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desktop-task-type">Task type</Label>
            <select
              id="desktop-task-type"
              className="app-select w-full"
              value={form.taskType}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  taskType: e.target.value,
                  customerID: "",
                  siteID: "",
                }))
              }
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desktop-task-priority">Priority</Label>
            <select
              id="desktop-task-priority"
              className="app-select w-full"
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {isCustomerVisit ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="desktop-task-customer">Customer</Label>
                <select
                  id="desktop-task-customer"
                  className="app-select w-full"
                  value={form.customerID}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, customerID: e.target.value, siteID: "" }))
                  }
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.label ||
                        `${c.customerCode ?? ""} — ${c.customerName ?? ""}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desktop-task-site">Site</Label>
                <select
                  id="desktop-task-site"
                  className="app-select w-full"
                  value={form.siteID}
                  onChange={(e) => setForm((p) => ({ ...p, siteID: e.target.value }))}
                  disabled={!form.customerID}
                >
                  <option value="">
                    {form.customerID ? "Select site" : "Select customer first"}
                  </option>
                  {sites.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.branchName
                        ? s.customer?.customerName
                          ? `${s.branchName} — ${s.customer.customerName}`
                          : s.branchName
                        : `Site #${s.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="desktop-task-schedule">Schedule</Label>
            <Input
              id="desktop-task-schedule"
              type="datetime-local"
              value={form.scheduleDateTime}
              onChange={(e) =>
                setForm((p) => ({ ...p, scheduleDateTime: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desktop-task-due">Due date & time</Label>
            <Input
              id="desktop-task-due"
              type="datetime-local"
              value={form.dueDateTime}
              onChange={(e) => setForm((p) => ({ ...p, dueDateTime: e.target.value }))}
              required={form.assignedEmployeeIds.length > 0}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="desktop-task-desc">Description</Label>
            <Textarea
              id="desktop-task-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Task details (optional)"
              rows={4}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Assign employees</Label>
            {!form.departmentID ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                Select a department to see employees you can assign.
              </p>
            ) : (
              <>
                <Input
                  type="search"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search by name or code"
                />
                <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {filteredAssignees.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">
                      No employees in this department
                    </p>
                  ) : (
                    filteredAssignees.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.assignedEmployeeIds.includes(emp.id)}
                          onChange={() => toggleAssignee(emp.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="text-sm">{empLabel(emp)}</span>
                      </label>
                    ))
                  )}
                </div>
                {form.assignedEmployeeIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {form.assignedEmployeeIds.length} selected
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={creating || !form.taskName.trim()}
          >
            {creating ? "Creating…" : "Create task"}
          </Button>
        </div>
      </div>
    );
  }

  if (!open || typeof document === "undefined") return null;

  const sheet = (
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/45"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[201] bg-white rounded-t-2xl flex flex-col shadow-2xl"
        style={{
          maxHeight: "min(92dvh, calc(100dvh - env(safe-area-inset-top) - 12px))",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-task-create-title"
      >
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 id="mobile-task-create-title" className="text-[17px] font-semibold text-gray-900">
              New task
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Add details and assign team members
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-100"
            aria-label="Close and discard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 min-h-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {loadingMeta && (
            <p className="text-xs text-gray-400 text-center">Loading options…</p>
          )}

          <div>
            <label className={labelClass}>Title *</label>
            <input
              type="text"
              value={form.taskName}
              onChange={(e) => setForm((p) => ({ ...p, taskName: e.target.value }))}
              placeholder="Enter task name"
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Task type</label>
              <select
                className={fieldClass}
                value={form.taskType}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    taskType: e.target.value,
                    customerID: "",
                    siteID: "",
                  }))
                }
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select
                className={fieldClass}
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Department</label>
            <select
              className={fieldClass}
              value={form.departmentID}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  departmentID: e.target.value,
                  assignedEmployeeIds: [],
                }))
              }
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.departmentName || `Department #${d.id}`}
                </option>
              ))}
            </select>
          </div>

          {isCustomerVisit && (
            <>
              <div>
                <label className={labelClass}>Customer</label>
                <select
                  className={fieldClass}
                  value={form.customerID}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, customerID: e.target.value, siteID: "" }))
                  }
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.label ||
                        `${c.customerCode ?? ""} — ${c.customerName ?? ""}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Site</label>
                <select
                  className={fieldClass}
                  value={form.siteID}
                  onChange={(e) => setForm((p) => ({ ...p, siteID: e.target.value }))}
                  disabled={!form.customerID}
                >
                  <option value="">
                    {form.customerID ? "Select site" : "Select customer first"}
                  </option>
                  {sites.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.branchName
                        ? s.customer?.customerName
                          ? `${s.branchName} — ${s.customer.customerName}`
                          : s.branchName
                        : `Site #${s.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Task details (optional)"
              rows={3}
              className={`${fieldClass} min-h-[80px] resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelClass}>Schedule</label>
              <input
                type="datetime-local"
                value={form.scheduleDateTime}
                onChange={(e) =>
                  setForm((p) => ({ ...p, scheduleDateTime: e.target.value }))
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Due date & time</label>
              <input
                type="datetime-local"
                value={form.dueDateTime}
                onChange={(e) => setForm((p) => ({ ...p, dueDateTime: e.target.value }))}
                className={fieldClass}
                required={form.assignedEmployeeIds.length > 0}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Assign employees</label>
            {!form.departmentID ? (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Select a department to see employees you can assign.
              </p>
            ) : (
              <>
                <input
                  type="search"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search by name or code"
                  className={`${fieldClass} mb-2`}
                />
                <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {filteredAssignees.length === 0 ? (
                    <p className="text-xs text-gray-500 p-3 text-center">
                      No employees in this department
                    </p>
                  ) : (
                    filteredAssignees.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-3 px-3 py-2.5 active:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.assignedEmployeeIds.includes(emp.id)}
                          onChange={() => toggleAssignee(emp.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">{empLabel(emp)}</span>
                      </label>
                    ))
                  )}
                </div>
                {form.assignedEmployeeIds.length > 0 && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    {form.assignedEmployeeIds.length} selected
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div
          className="shrink-0 flex gap-2 px-5 pt-3 pb-3 border-t border-gray-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[48px] rounded-xl border border-gray-200 text-[15px] font-semibold text-gray-700 active:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={creating || !form.taskName.trim()}
            className="flex-1 min-h-[48px] rounded-xl bg-[#4f46e5] text-white text-[15px] font-semibold disabled:opacity-50 active:opacity-90"
          >
            {creating ? "Creating…" : "Create task"}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(sheet, document.body);
}
