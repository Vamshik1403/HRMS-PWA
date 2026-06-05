"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import {
  decodeDateKey,
  extractDayPunchTimes,
  formatLocationLines,
  formatPunchTime,
  punchTypeLabel,
  type AttendanceLocationRecord,
} from "../../utils/empAttendanceHistory";
import { buildDaySummary, todayPunchDateKey } from "../../utils/attendanceDuration";
import { extractSiteVisitPunchesFromChats } from "../../utils/siteVisitPunches";
import { taskFetch } from "../../utils/taskApi";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import type { TaskChatMessage } from "../../components/task/task-types";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface SiteVisitTask {
  id: number;
  taskName: string;
  taskType: string;
  scheduleDateTime?: string | null;
  status: string;
  site?: { branchName?: string; city?: string } | null;
}

interface SiteVisitWithPunches extends SiteVisitTask {
  markIn: string | null;
  markOut: string | null;
  markInMessage: string | null;
  markOutMessage: string | null;
  punchesLoading?: boolean;
}

function fmtTime(iso: string) {
  return formatPunchTime(iso);
}

export default function EmpHistoryDayPage() {
  const params = useParams();
  const router = useRouter();
  const user = useCurrentUser();
  const dateKey = decodeDateKey(String(params.dateKey || ""));
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceLocationRecord[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisitWithPunches[]>([]);

  const dayTitle = useMemo(() => {
    try {
      // dateKey is "YYYY-MM-DD" — use UTC noon to avoid local-tz date shift
      return new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateKey;
    }
  }, [dateKey]);

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    if (!token) {
      router.replace("/login");
      return;
    }

    const dayStart = new Date(dateKey);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateKey);
    dayEnd.setHours(23, 59, 59, 999);
    const from = dayStart.toISOString().slice(0, 10);
    const to = dayEnd.toISOString().slice(0, 10);

    fetch(`${BACKEND}/emp-location-attendance/my?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AttendanceLocationRecord[]) => {
        const list = Array.isArray(data) ? data : [];
        // checkinTime is stored as wall-clock UTC — match on UTC date to avoid timezone shift
    const dayOnly = list.filter((r) => {
      const d = new Date(r.checkinTime);
      const utcKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return utcKey === dateKey;
    });
        setRecords(
          [...dayOnly].sort(
            (a, b) => new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
          ),
        );
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [dateKey, router]);

  useEffect(() => {
    if (!user) return;
    taskFetch<{ items: SiteVisitTask[] }>("/task-projects", user, undefined, { limit: 100 })
      .then((data) => {
        const items = data.items || [];
        const visits = items.filter((t) => {
          const type = (t.taskType || "").toLowerCase();
          if (!type.includes("site visit")) return false;
          if (!t.scheduleDateTime) return false;
          return new Date(t.scheduleDateTime).toDateString() === dateKey;
        });

        const withLoading: SiteVisitWithPunches[] = visits.map((t) => ({
          ...t,
          markIn: null,
          markOut: null,
          markInMessage: null,
          markOutMessage: null,
          punchesLoading: true,
        }));
        setSiteVisits(withLoading);

        Promise.all(
          visits.map(async (t) => {
            try {
              const detail = await taskFetch<{ chats?: TaskChatMessage[] }>(
                `/task-projects/${t.id}`,
                user,
              );
              const punches = extractSiteVisitPunchesFromChats(detail.chats || []);
              return { id: t.id, ...punches };
            } catch {
              return {
                id: t.id,
                markIn: null,
                markOut: null,
                markInMessage: null,
                markOutMessage: null,
              };
            }
          }),
        ).then((punchRows) => {
          setSiteVisits((prev) =>
            prev.map((v) => {
              const p = punchRows.find((r) => r.id === v.id);
              if (!p) return { ...v, punchesLoading: false };
              return {
                ...v,
                markIn: p.markIn,
                markOut: p.markOut,
                markInMessage: p.markInMessage,
                markOutMessage: p.markOutMessage,
                punchesLoading: false,
              };
            }),
          );
        });
      })
      .catch(() => setSiteVisits([]));
  }, [user, dateKey]);

  const summary = useMemo(
    () =>
      records.length
        ? buildDaySummary(records, { dateKey, live: dateKey === todayPunchDateKey() })
        : null,
    [records, dateKey],
  );
  const dayPunches = extractDayPunchTimes(records);

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-4 pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3"
        >
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-[20px] font-bold text-gray-900 mb-1">{dayTitle}</h1>
        {summary && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <span className="text-gray-400 text-[10px] font-bold uppercase">Mark IN</span>
                <p className="font-semibold text-gray-900">
                  {formatPunchTime(dayPunches.checkIn?.checkinTime)}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] font-bold uppercase">Mark OUT</span>
                <p className="font-semibold text-gray-900">
                  {formatPunchTime(dayPunches.checkOut?.checkinTime)}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] font-bold uppercase">Break IN</span>
                <p className="font-semibold text-amber-600">
                  {formatPunchTime(dayPunches.breakIn?.checkinTime)}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] font-bold uppercase">Break OUT</span>
                <p className="font-semibold text-emerald-600">
                  {formatPunchTime(dayPunches.breakOut?.checkinTime)}
                </p>
              </div>
            </div>
            <p className="text-[12px] text-gray-500 pt-1 border-t border-gray-100">
              Work {summary.workLabel} · Break {summary.breakLabel}
            </p>
            <div className="text-[11px] text-gray-500 space-y-2 pt-1 border-t border-gray-100">
              <LocationDetail label="Mark IN location" punch={dayPunches.checkIn} />
              <LocationDetail label="Mark OUT location" punch={dayPunches.checkOut} />
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center">
            <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : (
          <>
            <section className="mb-6">
              <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Attendance punches
              </h2>
              {records.length === 0 ? (
                <p className="text-[13px] text-gray-400 bg-white rounded-2xl border border-gray-100 p-4">
                  No punches recorded this day
                </p>
              ) : (
                <div className="space-y-2">
                  {records.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[14px] font-bold text-gray-900">
                          {punchTypeLabel(r.checkType)}
                        </p>
                        <p className="text-[13px] font-semibold text-gray-700">{fmtTime(r.checkinTime)}</p>
                      </div>
                      {r.accuracy != null && (
                        <p className="text-[11px] text-gray-400 mt-1">GPS ±{Math.round(r.accuracy)}m</p>
                      )}
                      {(() => {
                        const { address, coordinates } = formatLocationLines(r);
                        if (!address && !coordinates) return null;
                        return (
                          <div className="mt-0.5 space-y-0.5">
                            {address ? (
                              <p className="text-[11px] text-gray-500 flex items-start gap-1">
                                <Icon icon="solar:map-point-bold-duotone" className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-px" />
                                <span className="min-w-0">{address}</span>
                              </p>
                            ) : null}
                            {coordinates ? (
                              <p className="text-[10px] font-mono text-gray-400 pl-5">{coordinates}</p>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Site visits
              </h2>
              {siteVisits.length === 0 ? (
                <p className="text-[13px] text-gray-400 bg-white rounded-2xl border border-gray-100 p-4">
                  No site visit tasks scheduled this day
                </p>
              ) : (
                <div className="space-y-2">
                  {siteVisits.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3"
                    >
                      <p className="text-[14px] font-bold text-gray-900">{t.taskName}</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">
                        {t.site?.branchName || t.site?.city || "Site"} · {t.status}
                      </p>
                      {t.scheduleDateTime && (
                        <p className="text-[12px] text-[#2563eb] font-semibold mt-1">
                          Scheduled {fmtTime(t.scheduleDateTime)}
                        </p>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Site mark IN</p>
                          {t.punchesLoading ? (
                            <p className="text-[12px] text-gray-300 animate-pulse mt-0.5">Loading…</p>
                          ) : (
                            <p className="text-[13px] font-semibold text-gray-900 mt-0.5">
                              {t.markIn ? fmtTime(t.markIn) : "—"}
                            </p>
                          )}
                          {t.markInMessage && (
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{t.markInMessage}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Site mark OUT</p>
                          {t.punchesLoading ? (
                            <p className="text-[12px] text-gray-300 animate-pulse mt-0.5">Loading…</p>
                          ) : (
                            <p className="text-[13px] font-semibold text-gray-900 mt-0.5">
                              {t.markOut ? fmtTime(t.markOut) : "—"}
                            </p>
                          )}
                          {t.markOutMessage && (
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{t.markOutMessage}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </EmpMobileLayout>
  );
}

function LocationDetail({
  label,
  punch,
}: {
  label: string;
  punch: { latitude?: number | null; longitude?: number | null; address?: string | null } | null;
}) {
  const { address, coordinates } = formatLocationLines(punch);
  return (
    <div>
      <p className="font-semibold text-gray-600">{label}</p>
      {address ? <p className="text-gray-600 mt-0.5">{address}</p> : <p className="text-gray-400 mt-0.5">—</p>}
      {coordinates ? <p className="font-mono text-[10px] text-gray-500 mt-0.5">{coordinates}</p> : null}
    </div>
  );
}
