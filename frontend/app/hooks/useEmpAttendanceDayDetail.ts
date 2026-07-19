"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  decodeDateKey,
  extractDayPunchTimes,
  type AttendanceLocationRecord,
} from "../utils/empAttendanceHistory";
import { buildDaySummary, todayPunchDateKey } from "../utils/attendanceDuration";
import { extractSiteVisitPunchesFromChats } from "../utils/siteVisitPunches";
import { taskFetch } from "../utils/taskApi";
import { useCurrentUser } from "./useCurrentUser";
import type { TaskChatMessage } from "../components/task/task-types";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export interface SiteVisitTask {
  id: number;
  taskName: string;
  taskType: string;
  scheduleDateTime?: string | null;
  status: string;
  site?: { branchName?: string; city?: string } | null;
}

export interface SiteVisitWithPunches extends SiteVisitTask {
  markIn: string | null;
  markOut: string | null;
  markInMessage: string | null;
  markOutMessage: string | null;
  punchesLoading?: boolean;
}

export function useEmpAttendanceDayDetail() {
  const params = useParams();
  const router = useRouter();
  const user = useCurrentUser();
  const dateKey = decodeDateKey(String(params.dateKey || ""));
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceLocationRecord[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisitWithPunches[]>([]);

  const dayTitle = useMemo(() => {
    try {
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

  return {
    dateKey,
    dayTitle,
    loading,
    records,
    siteVisits,
    summary,
    dayPunches,
    router,
  };
}
