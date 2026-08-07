"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Clock, ListTodo, MapPin, Plus, Trash2 } from "lucide-react";
import { Icon } from "@iconify/react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { DashboardSection } from "@/app/dashboard/components/dashboard-ui";
import { useEmpCalendarDayDetail } from "@/app/hooks/useEmpCalendarDayDetail";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import {
  formatLocationLines,
  formatPunchTime,
  punchTypeLabel,
} from "@/app/utils/empAttendanceHistory";
import {
  addTodoForDate,
  listTodosForDate,
  removeTodoForDate,
  toggleTodoForDate,
  type EmpCalendarTodoItem,
} from "@/app/utils/empCalendarTodos";
import { cn } from "@/app/utils/cn";

export type CalendarDayDetailSection = "punches" | "sites" | "tasks" | "todo" | "all";

function resolveEmployeeId(user: any): number {
  return Number(user?.employee?.id ?? user?.employeeID ?? user?.manageEmployeeID ?? 0) || 0;
}

export function EmpCalendarDayDetailPanel({
  dateKey,
  section,
}: {
  dateKey: string;
  section: CalendarDayDetailSection;
}) {
  const user = useCurrentUser();
  const employeeId = resolveEmployeeId(user);
  const { dayTitle, loading, records, siteVisits, tasks, todos, summary, dayPunches } =
    useEmpCalendarDayDetail(dateKey);

  const [personalTodos, setPersonalTodos] = useState<EmpCalendarTodoItem[]>([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const showPunches = section === "punches" || section === "all";
  const showSites = section === "sites" || section === "all";
  const showTasks = section === "tasks" || section === "all";
  const showTodo = section === "todo" || section === "all";

  const refreshPersonalTodos = () => {
    if (!employeeId || !dateKey) {
      setPersonalTodos([]);
      return;
    }
    setPersonalTodos(listTodosForDate(employeeId, dateKey));
  };

  useEffect(() => {
    refreshPersonalTodos();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.employeeId && Number(detail.employeeId) !== employeeId) return;
      refreshPersonalTodos();
    };
    window.addEventListener("emp-calendar-todos-changed", onChange);
    return () => window.removeEventListener("emp-calendar-todos-changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, dateKey]);

  const handleAdd = () => {
    if (!employeeId || !dateKey || !draft.trim()) return;
    try {
      addTodoForDate(employeeId, dateKey, draft);
      setDraft("");
      setAdding(false);
      refreshPersonalTodos();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Icon icon="solar:refresh-bold-duotone" className="w-7 h-7 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <h3 className="text-base font-semibold text-foreground">{dayTitle}</h3>
        {summary ? (
          <p className="text-sm text-muted-foreground mt-0.5">
            Work {summary.workLabel} · Break {summary.breakLabel}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-0.5">No attendance summary for this day</p>
        )}
      </div>

      <div className="p-5 space-y-6">
        {summary && showPunches ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Mark in", value: formatPunchTime(dayPunches.checkIn?.checkinTime) },
              { label: "Mark out", value: formatPunchTime(dayPunches.checkOut?.checkinTime) },
              { label: "Break in", value: formatPunchTime(dayPunches.breakIn?.checkinTime) },
              { label: "Break out", value: formatPunchTime(dayPunches.breakOut?.checkinTime) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-sm font-semibold tabular-nums mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {showPunches ? (
          <DashboardSection className="p-0 border-0 shadow-none">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Attendance punches
            </h4>
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3 py-6 text-center rounded-xl border border-dashed border-border">
                No punches recorded this day
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="px-3 py-2.5 font-medium text-muted-foreground">Type</th>
                      <th className="px-3 py-2.5 font-medium text-muted-foreground">Time</th>
                      <th className="px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const { address } = formatLocationLines(r);
                      return (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2.5 font-medium">{punchTypeLabel(r.checkType)}</td>
                          <td className="px-3 py-2.5 tabular-nums">{formatPunchTime(r.checkinTime)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell truncate max-w-xs">
                            {address || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardSection>
        ) : null}

        {showSites ? (
          <DashboardSection className="p-0 border-0 shadow-none">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              Site visits
            </h4>
            {siteVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3 py-6 text-center rounded-xl border border-dashed border-border">
                No site visits scheduled this day
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {siteVisits.map((t) => (
                  <div key={t.id} className="rounded-xl border border-border p-4">
                    <p className="font-semibold text-foreground">{t.taskName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.site?.branchName || t.site?.city || t.taskType || "Site visit"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        In {t.markIn || "—"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        Out {t.markOut || "—"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        ) : null}

        {showTasks ? (
          <DashboardSection className="p-0 border-0 shadow-none">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListTodo className="size-4 text-primary" />
              Tasks
            </h4>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3 py-6 text-center rounded-xl border border-dashed border-border">
                No tasks for this day
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{t.taskName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.taskType}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {t.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        ) : null}

        {showTodo ? (
          <DashboardSection className="p-0 border-0 shadow-none">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckSquare className="size-4 text-primary" />
                ToDo
              </h4>
              {employeeId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 rounded-lg px-2.5"
                  onClick={() => setAdding((v) => !v)}
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              ) : null}
            </div>

            {adding ? (
              <div className="mt-3 flex gap-2">
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a to-do for this date…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
                <Button type="button" size="sm" className="shrink-0" onClick={handleAdd} disabled={!draft.trim()}>
                  Save
                </Button>
              </div>
            ) : null}

            {personalTodos.length === 0 && todos.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3 py-6 text-center rounded-xl border border-dashed border-border">
                No to-do items for this day. Tap + to add one.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {personalTodos.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
                  >
                    <button
                      type="button"
                      aria-label={t.done ? "Mark incomplete" : "Mark complete"}
                      className={cn(
                        "size-4 shrink-0 rounded border",
                        t.done ? "border-primary bg-primary" : "border-muted-foreground/40",
                      )}
                      onClick={() => {
                        toggleTodoForDate(employeeId, dateKey, t.id);
                        refreshPersonalTodos();
                      }}
                    />
                    <p
                      className={cn(
                        "min-w-0 flex-1 text-sm font-medium text-foreground",
                        t.done && "line-through text-muted-foreground",
                      )}
                    >
                      {t.text}
                    </p>
                    <button
                      type="button"
                      aria-label="Delete to-do"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        removeTodoForDate(employeeId, dateKey, t.id);
                        refreshPersonalTodos();
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
                {todos.map((t) => (
                  <div
                    key={`task-${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{t.taskName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.taskType || "ToDo"}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {t.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        ) : null}
      </div>
    </div>
  );
}
