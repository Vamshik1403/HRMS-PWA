"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { taskFetch } from "@/app/utils/taskApi";
import { localDateISO } from "@/app/utils/localDate";
import { CATEGORIES } from "./EmpReimbursementMobile";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type LineItem = { reimbursementType: string; amount: string; description: string };

interface EmployeeTask {
  id: number;
  taskCode: string;
  taskName: string;
  customer?: { customerName?: string };
  site?: { branchName?: string };
}

export function EmpReimbursementApplyForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const user = useCurrentUser();
  const [creds, setCreds] = useState<any>(null);
  const [employeeTasks, setEmployeeTasks] = useState<EmployeeTask[]>([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<EmployeeTask | null>(null);
  const [taskSuggestOpen, setTaskSuggestOpen] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ reimbursementType: "Travelling", amount: "", description: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const today = useMemo(() => localDateISO(), []);
  const [date, setDate] = useState(today);

  useEffect(() => {
    const username = user?.username;
    const empId = user?.employee?.id ?? (user?.role === "EMPLOYEE" ? user?.id : undefined);
    if (!username && !empId) return;
    let cancelled = false;
    (async () => {
      let row: any = null;
      if (username) {
        const r = await fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(username)}`);
        if (r.ok) row = await r.json();
      }
      if (!row?.employee?.id && empId) {
        const r = await fetch(`${BACKEND}/manage-emp/${empId}/credentials`);
        if (r.ok) {
          const json = await r.json();
          if (json?.employee?.id || json?.companyID) row = json;
        }
      }
      if (!row?.employee?.id && (empId || user?.companyID)) {
        row = {
          serviceProviderID: user?.serviceProviderID ?? null,
          companyID: user?.companyID ?? null,
          branchesID: user?.branchesID ?? null,
          employee: { id: empId },
        };
      }
      if (!cancelled) setCreds(row);
    })().catch(() => {
      if (!cancelled) setCreds(null);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    taskFetch<{ items: EmployeeTask[] }>("/task-projects", user, undefined, {
      limit: 100,
      assignedToMe: 1,
    })
      .then((data) => setEmployeeTasks(data.items || []))
      .catch(() => setEmployeeTasks([]));
  }, [user]);

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

  const submit = async () => {
    if (!creds?.employee?.id || total <= 0) {
      toast.error("Please add at least one expense with an amount.");
      return;
    }
    if (!date || date > today) {
      toast.error("Date cannot be in the future.");
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
          taskProjectID: selectedTask?.id ?? undefined,
          items: items.filter((i) => i.amount && parseFloat(i.amount) > 0),
        }),
      });
      if (!res.ok) {
        let apiMessage = "Could not submit reimbursement";
        try {
          const body = await res.json();
          if (typeof body?.message === "string" && body.message.trim()) apiMessage = body.message;
          else if (Array.isArray(body?.message) && body.message[0]) apiMessage = String(body.message[0]);
        } catch {
          /* ignore */
        }
        throw new Error(apiMessage);
      }
      toast.success("Reimbursement submitted");
      onSuccess();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit reimbursement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Date</Label>
        <Input
          type="date"
          className="mt-1"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="relative space-y-2">
        <Label>Task (optional)</Label>
        {selectedTask ? (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{selectedTask.taskName}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {selectedTask.taskCode} · #{selectedTask.id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedTask(null);
                setTaskSearch("");
              }}
              className="shrink-0 size-7 rounded-full border flex items-center justify-center"
              aria-label="Clear task"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Input
              value={taskSearch}
              onChange={(e) => {
                setTaskSearch(e.target.value);
                setTaskSuggestOpen(true);
              }}
              onFocus={() => setTaskSuggestOpen(true)}
              placeholder="Link to a task (optional)…"
            />
            {taskSuggestOpen && filteredTasks.length > 0 ? (
              <ul className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                {filteredTasks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-0"
                      onClick={() => {
                        setSelectedTask(t);
                        setTaskSearch("");
                        setTaskSuggestOpen(false);
                      }}
                    >
                      <p className="text-sm font-medium truncate">{t.taskName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {t.taskCode} · #{t.id}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-3">
        <Label>Expenses</Label>
        {items.map((item, idx) => (
          <div key={idx} className="rounded-lg border p-3 space-y-2 relative">
            {items.length > 1 ? (
              <button
                type="button"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                className="absolute top-2 right-2 size-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"
                aria-label="Remove line"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
            <select
              value={item.reimbursementType}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...next[idx], reimbursementType: e.target.value };
                setItems(next);
              }}
              className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Input
              placeholder="Description"
              value={item.description}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...next[idx], description: e.target.value };
                setItems(next);
              }}
            />
            <Input
              type="number"
              placeholder="Amount"
              value={item.amount}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...next[idx], amount: e.target.value };
                setItems(next);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, { reimbursementType: "Travelling", amount: "", description: "" }])}
          className="text-sm font-medium text-primary"
        >
          + Add expense line
        </button>
      </div>

      <p className="text-sm font-semibold border-t pt-3">Total: ₹{total.toFixed(2)}</p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" onClick={() => void submit()} disabled={submitting || total <= 0}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </div>
  );
}
