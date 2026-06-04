"use client";

import { useCallback, useEffect, useRef } from "react";
import { APP_REFRESH_EVENT } from "../utils/appRefresh";

/**
 * Run `load` on mount, when sidebar company context changes, and after mutations
 * (dispatchAppRefresh / sidebar refresh button).
 */
export function useListAutoRefresh(
  load: () => void | Promise<void>,
  deps: unknown[] = [],
  enabled = true,
) {
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(() => {
    if (enabled) void loadRef.current();
  }, [enabled]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  useEffect(() => {
    const onRefresh = () => run();
    window.addEventListener("sidebar-context-changed", onRefresh);
    window.addEventListener(APP_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener("sidebar-context-changed", onRefresh);
      window.removeEventListener(APP_REFRESH_EVENT, onRefresh);
    };
  }, [run]);
}
