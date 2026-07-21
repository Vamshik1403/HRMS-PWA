"use client";

import { CheckSquare, Clock, ListTodo, MapPin } from "lucide-react";
import { Icon } from "@iconify/react";
import { Badge } from "../../ui/badge";
import { DashboardSection } from "@/app/dashboard/components/dashboard-ui";
import { useEmpCalendarDayDetail } from "@/app/hooks/useEmpCalendarDayDetail";
import {
  formatLocationLines,
  formatPunchTime,
  punchTypeLabel,
} from "@/app/utils/empAttendanceHistory";
import { cn } from "@/app/utils/cn";

export type CalendarDayDetailSection = "punches" | "sites" | "tasks" | "todo";

export function EmpCalendarDayDetailPanel({
  dateKey,
  section,
}: {
  dateKey: string;
  section: CalendarDayDetailSection;
}) {
  const { dayTitle, loading, records, siteVisits, tasks, todos, summary, dayPunches } =
    useEmpCalendarDayDetail(dateKey);

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
        {summary && section === "punches" ? (
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

        {section === "punches" ? (
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

        {section === "sites" ? (
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
                      {t.site?.branchName || t.site?.city || "Site"} · {t.status}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-border pt-3">
                      <div>
                        <p className="text-muted-foreground">Site in</p>
                        <p className="font-semibold mt-0.5">
                          {t.punchesLoading ? "…" : t.markIn ? formatPunchTime(t.markIn) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Site out</p>
                        <p className="font-semibold mt-0.5">
                          {t.punchesLoading ? "…" : t.markOut ? formatPunchTime(t.markOut) : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        ) : null}

        {section === "tasks" ? (
          <DashboardSection className="p-0 border-0 shadow-none">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListTodo className="size-4 text-primary" />
              Tasks
            </h4>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3 py-6 text-center rounded-xl border border-dashed border-border">
                No tasks scheduled this day
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{t.taskName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.taskType || "Task"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="text-[10px]">
                        {t.status}
                      </Badge>
                      {t.scheduleDateTime ? (
                        <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                          {formatPunchTime(t.scheduleDateTime)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        ) : null}

        {section === "todo" ? (
          <DashboardSection className="p-0 border-0 shadow-none">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckSquare className="size-4 text-primary" />
              ToDo
            </h4>
            {todos.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3 py-6 text-center rounded-xl border border-dashed border-border">
                No to-do items for this day
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {todos.map((t) => (
                  <div
                    key={t.id}
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
