"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react";
import { Icon } from "@iconify/react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { Badge } from "../../ui/badge";
import { cardShell, DashboardSection, gridGap } from "@/app/dashboard/components/dashboard-ui";
import { useEmpAttendanceDayDetail } from "@/app/hooks/useEmpAttendanceDayDetail";
import {
  formatLocationLines,
  formatPunchTime,
  punchTypeLabel,
} from "@/app/utils/empAttendanceHistory";
import { cn } from "@/app/utils/cn";

function LocationBlock({
  label,
  punch,
}: {
  label: string;
  punch: { latitude?: number | null; longitude?: number | null; address?: string | null } | null;
}) {
  const { address, coordinates } = formatLocationLines(punch);
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {address ? <p className="mt-2 text-sm text-foreground">{address}</p> : <p className="mt-2 text-sm text-muted-foreground">—</p>}
      {coordinates ? <p className="mt-1 font-mono text-xs text-muted-foreground">{coordinates}</p> : null}
    </div>
  );
}

export function EmpDesktopAttendanceDayDetail() {
  const { dayTitle, loading, records, siteVisits, summary, dayPunches } = useEmpAttendanceDayDetail();

  return (
    <EmpDesktopPage
      title={dayTitle}
      description="Daily attendance breakdown, punches, and site visits"
      icon={Calendar}
      actions={
        <Link
          href="/empAttendance?tab=overview"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to attendance
        </Link>
      }
    >
      {loading ? (
        <div className="py-16 flex justify-center">
          <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {summary ? (
            <>
              <div className={`grid sm:grid-cols-2 lg:grid-cols-4 ${gridGap}`}>
                {[
                  { label: "Mark in", value: formatPunchTime(dayPunches.checkIn?.checkinTime), tone: "text-foreground" },
                  { label: "Mark out", value: formatPunchTime(dayPunches.checkOut?.checkinTime), tone: "text-foreground" },
                  { label: "Break in", value: formatPunchTime(dayPunches.breakIn?.checkinTime), tone: "text-amber-600" },
                  { label: "Break out", value: formatPunchTime(dayPunches.breakOut?.checkinTime), tone: "text-emerald-600" },
                ].map((item) => (
                  <div key={item.label} className={cn(cardShell, "p-5")}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className={cn("mt-2 text-2xl font-bold tabular-nums", item.tone)}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className={cn(cardShell, "p-5 flex flex-wrap items-center gap-4")}>
                <div className="flex items-center gap-2">
                  <Clock className="size-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Work {summary.workLabel} · Break {summary.breakLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">Total duration for this day</p>
                  </div>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {records.length} punch{records.length === 1 ? "" : "es"}
                </Badge>
              </div>

              <div className={`grid lg:grid-cols-2 ${gridGap}`}>
                <LocationBlock label="Mark in location" punch={dayPunches.checkIn} />
                <LocationBlock label="Mark out location" punch={dayPunches.checkOut} />
              </div>
            </>
          ) : null}

          <DashboardSection>
            <h2 className="text-lg font-semibold tracking-tight">Attendance punches</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Chronological punch log for this day</p>
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
                No punches recorded this day
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Time</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Location</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">GPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const { address, coordinates } = formatLocationLines(r);
                      return (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-semibold">{punchTypeLabel(r.checkType)}</td>
                          <td className="px-4 py-3 tabular-nums">{formatPunchTime(r.checkinTime)}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                            {address || "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                            {coordinates || (r.accuracy != null ? `±${Math.round(r.accuracy)}m` : "—")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardSection>

          <DashboardSection>
            <h2 className="text-lg font-semibold tracking-tight">Site visits</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Scheduled site visit tasks and punch activity</p>
            {siteVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
                No site visit tasks scheduled this day
              </p>
            ) : (
              <div className={`grid md:grid-cols-2 ${gridGap}`}>
                {siteVisits.map((t) => (
                  <div key={t.id} className={cn(cardShell, "p-5")}>
                    <div className="flex items-start gap-3">
                      <span className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                        <MapPin className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{t.taskName}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {t.site?.branchName || t.site?.city || "Site"} · {t.status}
                        </p>
                        {t.scheduleDateTime ? (
                          <p className="text-xs font-medium text-primary mt-1">
                            Scheduled {formatPunchTime(t.scheduleDateTime)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Site mark in</p>
                        <p className="text-sm font-semibold mt-1">
                          {t.punchesLoading ? "…" : t.markIn ? formatPunchTime(t.markIn) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Site mark out</p>
                        <p className="text-sm font-semibold mt-1">
                          {t.punchesLoading ? "…" : t.markOut ? formatPunchTime(t.markOut) : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        </div>
      )}
    </EmpDesktopPage>
  );
}
