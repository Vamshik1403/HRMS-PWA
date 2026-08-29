"use client";

import { useEffect, useMemo, useState } from "react";
import {
  extractDayPunchTimes,
  type AttendanceLocationRecord,
} from "../utils/empAttendanceHistory";
import { buildDaySummary, todayPunchDateKey } from "../utils/attendanceDuration";
import { extractSiteVisitPunchesFromChats } from "../utils/siteVisitPunches";
import { taskFetch } from "../utils/taskApi";
import { useCurrentUser } from "./useCurrentUser";
import type { TaskChatMessage } from "../components/task/task-types";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export interface CalendarDayTask {
  id: number;
  taskName: string;
  taskType: string;
  scheduleDateTime?: string | null;
  status: string;
  site?: { branchName?: string; city?: string } | null;
}

export interface SiteVisitWithPunches extends CalendarDayTask {
  markIn: string | null;
  markOut: string | null;
  markInMessage: string | null;
  markOutMessage: string | null;
  punchesLoading?: boolean;
}

function taskDateKey(scheduleDateTime: string): string {
  const d = new Date(scheduleDateTime);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useEmpCalendarDayDetail(dateKey: string | null) {
  const user = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceLocationRecord[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisitWithPunches[]>([]);
  const [tasks, setTasks] = useState<CalendarDayTask[]>([]);

  const dayTitle = useMemo(() => {
    if (!dateKey) return "";
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
    if (!dateKey) {
      setRecords([]);
      setSiteVisits([]);
      setTasks([]);
      return;
    }

    const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    if (!token) return;

    setLoading(true);
    fetch(`${BACKEND}/emp-location-attendance/my?from=${dateKey}&to=${dateKey}`, {
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
  }, [dateKey]);

  useEffect(() => {
    if (!dateKey || !user) {
      setSiteVisits([]);
      setTasks([]);
      return;
    }

    taskFetch<{ items: CalendarDayTask[] }>("/task-projects", user, undefined, {
      limit: 100,
      assignedToMe: 1,
    })
      .then((data) => {
        const items = data.items || [];
        const dayTasks = items.filter((t) => t.scheduleDateTime && taskDateKey(t.scheduleDateTime) === dateKey);
        setTasks(dayTasks);

        const visits = dayTasks.filter((t) => {
          const type = (t.taskType || "").toLowerCase();
          return type.includes("site visit") || type.includes("customer visit");
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
      .catch(() => {
        setSiteVisits([]);
        setTasks([]);
      });
  }, [user, dateKey]);

  const summary = useMemo(
    () =>
      records.length && dateKey
        ? buildDaySummary(records, { dateKey, live: dateKey === todayPunchDateKey() })
        : null,
    [records, dateKey],
  );
  const dayPunches = extractDayPunchTimes(records);

  const nonSiteTasks = useMemo(
    () =>
      tasks.filter((t) => {
        const type = (t.taskType || "").toLowerCase();
        return !(type.includes("site visit") || type.includes("customer visit"));
      }),
    [tasks],
  );

  const todos = useMemo(
    () =>
      nonSiteTasks.filter((t) => {
        const type = (t.taskType || "").toLowerCase();
        const status = (t.status || "").toLowerCase();
        return type.includes("todo") || type.includes("to-do") || status.includes("todo");
      }),
    [nonSiteTasks],
  );

  const regularTasks = useMemo(
    () =>
      nonSiteTasks.filter((t) => {
        const type = (t.taskType || "").toLowerCase();
        const status = (t.status || "").toLowerCase();
        return !(type.includes("todo") || type.includes("to-do") || status.includes("todo"));
      }),
    [nonSiteTasks],
  );

  return {
    dateKey,
    dayTitle,
    loading,
    records,
    siteVisits,
    tasks: regularTasks,
    todos,
    summary,
    dayPunches,
  };
}
