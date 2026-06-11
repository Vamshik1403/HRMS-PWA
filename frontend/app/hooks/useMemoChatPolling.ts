"use client";

import { useEffect, useRef } from "react";

/** Poll IM thread while chat is open so new messages appear without a manual refresh. */
export function useMemoChatPolling<T>(
  memoId: number | null | undefined,
  onUpdate: (memo: T) => void,
  enabled: boolean,
  intervalMs = 2000,
  getHeaders?: () => Record<string, string>,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || !memoId) return;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const headers = getHeaders?.() ?? {};
        const res = await fetch(`/backend/employee-memo/${memoId}`, {
          cache: "no-store",
          headers,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) onUpdateRef.current(data);
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
  }, [memoId, enabled, intervalMs, getHeaders]);
}
