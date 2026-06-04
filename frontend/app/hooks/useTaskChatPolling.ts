"use client";

import { useEffect, useRef } from "react";
import { taskFetch, type CurrentUserLike } from "../utils/taskApi";

/** Poll task detail while chat is open so new messages appear without a manual refresh. */
export function useTaskChatPolling<T extends { id: number }>(
  taskId: number | null | undefined,
  user: CurrentUserLike | null | undefined,
  onUpdate: (task: T) => void,
  enabled: boolean,
  intervalMs = 1000,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || !taskId || !user) return;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const full = await taskFetch<T>(`/task-projects/${taskId}`, user);
        if (!cancelled) onUpdateRef.current(full);
      } catch {
        /* ignore transient errors */
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const timer = window.setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    const onFocus = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [taskId, user, enabled, intervalMs]);
}
