"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { CATEGORIES } from "../../components/emp/EmpReimbursementMobile";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { taskFetch } from "../../utils/taskApi";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type LineItem = { reimbursementType: string; amount: string; description: string };

export default function EmpReimbursementNewPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [creds, setCreds] = useState<any>(null);
  const [taskIdInput, setTaskIdInput] = useState("");
  const [taskPreview, setTaskPreview] = useState<string | null>(null);
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
    const id = parseInt(taskIdInput, 10);
    if (!id || !user) {
      setTaskPreview(null);
      return;
    }
    const t = setTimeout(() => {
      taskFetch<any>(`/task-projects/${id}`, user)
        .then((t) => {
          const loc = [t.customer?.customerName, t.site?.branchName].filter(Boolean).join(" · ");
          setTaskPreview(loc || t.taskName || "Task found");
        })
        .catch(() => setTaskPreview("Task not found"));
    }, 400);
    return () => clearTimeout(t);
  }, [taskIdInput, user]);

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const submit = async () => {
    if (!creds?.employee?.id || total <= 0) return;
    setSubmitting(true);
    try {
      const taskProjectID = taskIdInput ? parseInt(taskIdInput, 10) : undefined;
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
          taskProjectID: Number.isFinite(taskProjectID) ? taskProjectID : undefined,
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
            <label className="text-[11px] font-semibold text-gray-500">Task ID</label>
            <input
              type="number"
              value={taskIdInput}
              onChange={(e) => setTaskIdInput(e.target.value)}
              placeholder="Enter task ID"
              className="w-full mt-1 h-11 rounded-xl border border-gray-200 px-3 text-[14px]"
            />
            {taskPreview && <p className="text-[12px] text-[#2563eb] mt-1">{taskPreview}</p>}
          </div>

          <p className="text-[11px] font-bold text-gray-400 uppercase">Expenses</p>
          {items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 p-3 space-y-2">
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
            disabled={submitting || total <= 0}
            className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-bold text-sm disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </EmpMobileLayout>
  );
}
