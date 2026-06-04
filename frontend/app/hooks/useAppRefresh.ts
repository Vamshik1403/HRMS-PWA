"use client";

import { useEffect } from "react";
import { APP_REFRESH_EVENT } from "../utils/appRefresh";

/**
 * Re-run `onRefresh` when the sidebar refresh button or a mutation dispatches app refresh.
 * Prefer `useListAutoRefresh` for standard list pages (mount + sidebar + global refresh).
 */
export function useAppRefresh(onRefresh: () => void | Promise<void>, deps: unknown[] = []) {
  useEffect(() => {
    const run = () => {
      void onRefresh();
    };
    window.addEventListener(APP_REFRESH_EVENT, run);
    window.addEventListener("sidebar-context-changed", run);
    return () => {
      window.removeEventListener(APP_REFRESH_EVENT, run);
      window.removeEventListener("sidebar-context-changed", run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
