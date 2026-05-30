"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { X } from "lucide-react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { CATEGORIES } from "../../components/emp/EmpReimbursementMobile";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { taskFetch } from "../../utils/taskApi";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type LineItem = { reimbursementType: string; amount: string; description: string };
type ReimbursementCategory = "task" | "general";

interface EmployeeTask {
  id: number;
  taskCode: string;
  taskName: string;
  customer?: { customerName?: string };
  site?: { branchName?: string };
}

export default function EmpReimbursementNewPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [creds, setCreds] = useState<any>(null);
  const [category, setCategory] = useState<ReimbursementCategory>("general");
  const [employeeTasks, setEmployeeTasks] = useState<EmployeeTask[]>([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<EmployeeTask | null>(null);
  const [taskSuggestOpen, setTaskSuggestOpen] = useState(false);
  const [items, setItems] = useState<LineItem[]>([
    { reimbursementType: "Travelling", amount: "", description: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!user?.username) return;
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCreds);
  }, [user]);

  useEffect(() => {
    if (!user || category !== "task") return;
    taskFetch<{ items: EmployeeTask[] }>("/task-projects", user, undefined, { limit: 100 })
      .then((data) => setEmployeeTasks(data.items || []))
      .catch(() => setEmployeeTasks([]));
  }, [user, category]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return employeeTasks.slice(0, 12);
    return employeeTasks
      .filter(
        (t) =>
          String(t.id).includes(q) ||
          t.taskCode.toLowerCase().includes(q) ||
          t.taskName.toLowerCase().includes(q) ||
          (t.customer?.customerName || "").toLowerCase().includes(q) ||
          (t.site?.branchName || "").toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [employeeTasks, taskSearch]);

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const removeLine = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!creds?.employee?.id || total <= 0) return;
    if (category === "task" && !selectedTask) {
      alert("Please select a task for task-based reimbursement.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/reimbursement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceProviderID: creds.serviceProviderID,
          companyID: creds.companyID,
          branchesID: creds.branchesID,
          manageEmployeeID: creds.employee.id,
          date,
          status: "Pending",
          taskProjectID: category === "task" ? selectedTask?.id : undefined,
          items: items.filter((i) => i.amount && parseFloat(i.amount) > 0),
        }),
      });
      if (!res.ok) throw new Error("fail");
      router.replace("/empReimbursement");
    } catch {
      alert("Could not submit reimbursement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-4 pb-8">
        <button type="button" onClick={() => router.back()} className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3">
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-[20px] font-bold text-gray-900 mb-4">New reimbursement</h1>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-gray-500">Date</label>
            <p className="text-[14px] font-semibold text-gray-900 mt-0.5">{date}</p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-500 block mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategory("task");
                  setSelectedTask(null);
                  setTaskSearch("");
                }}
                className={`py-2.5 rounded-xl border text-[13px] font-semibold ${
                  category === "task"
                    ? "border-[#2563eb] bg-blue-50 text-[#2563eb]"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                Task-based
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory("general");
                  setSelectedTask(null);
                  setTaskSearch("");
                  setTaskSuggestOpen(false);
                }}
                className={`py-2.5 rounded-xl border text-[13px] font-semibold ${
                  category === "general"
                    ? "border-[#2563eb] bg-blue-50 text-[#2563eb]"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                General
              </button>
            </div>
          </div>

          {category === "task" && (
            <div className="relative">
              <label className="text-[11px] font-semibold text-gray-500">Task</label>
              {selectedTask ? (
                <div className="mt-1 flex items-start justify-between gap-2 rounded-xl border border-[#2563eb]/30 bg-blue-50/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{selectedTask.taskName}</p>
                    <p className="text-[11px] text-gray-500 font-mono">
                      {selectedTask.taskCode} · #{selectedTask.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTask(null);
                      setTaskSearch("");
                    }}
                    className="shrink-0 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500"
                    aria-label="Clear task"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    value={taskSearch}
                    onChange={(e) => {
                      setTaskSearch(e.target.value);
                      setTaskSuggestOpen(true);
                    }}
                    onFocus={() => setTaskSuggestOpen(true)}
                    placeholder="Search by task name, ID or code…"
                    className="w-full mt-1 h-11 rounded-xl border border-gray-200 px-3 text-[14px]"
                  />
                  {taskSuggestOpen && filteredTasks.length > 0 && (
                    <ul className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg">
                      {filteredTasks.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                            onClick={() => {
                              setSelectedTask(t);
                              setTaskSearch("");
                              setTaskSuggestOpen(false);
                            }}
                          >
                            <p className="text-[13px] font-medium text-gray-900 line-clamp-1">{t.taskName}</p>
                            <p className="text-[11px] text-gray-500 font-mono">
                              {t.taskCode} · #{t.id}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {taskSuggestOpen && taskSearch && filteredTasks.length === 0 && (
                    <p className="text-[12px] text-gray-400 mt-1 px-1">No matching tasks</p>
                  )}
                </>
              )}
            </div>
          )}

          <p className="text-[11px] font-bold text-gray-400 uppercase">Expenses</p>
          {items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 p-3 space-y-2 relative">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500"
                  aria-label="Remove expense line"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <select
                value={item.reimbursementType}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], reimbursementType: e.target.value };
                  setItems(next);
                }}
                className="w-full h-10 rounded-lg border border-gray-200 px-2 text-[13px]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                placeholder="Description"
                value={item.description}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], description: e.target.value };
                  setItems(next);
                }}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-[13px]"
              />
              <input
                type="number"
                placeholder="Amount"
                value={item.amount}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], amount: e.target.value };
                  setItems(next);
                }}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-[13px]"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems([...items, { reimbursementType: "Travelling", amount: "", description: "" }])}
            className="text-[12px] font-semibold text-[#2563eb]"
          >
            + Add expense line
          </button>

          <p className="text-[15px] font-bold text-gray-900 pt-2 border-t border-gray-100">
            Total: ₹{total.toFixed(2)}
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || total <= 0 || (category === "task" && !selectedTask)}
            className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-bold text-sm disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </EmpMobileLayout>
  );
}
