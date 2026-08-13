"use client";

import { useEffect, useMemo } from "react";

/**
 * When the user re-clicks the active sidebar section, pages/forms should
 * return to their table/list view. EmpNavLink / admin NavLink dispatch
 * `sidebar-main-page-click` for that.
 *
 * @param onClose - Close form/detail panels and restore the list view.
 * @param enabled - When false, the listener is idle (e.g. form already closed).
 * @param paths - Optional path filter. If omitted, any sidebar main click closes.
 */
export function useSidebarMainPageClick(
  onClose: () => void,
  enabled = true,
  paths?: string | string[],
) {
  const allowedKey = useMemo(() => {
    if (paths == null) return "";
    return (Array.isArray(paths) ? paths : [paths]).join("|");
  }, [paths]);

  useEffect(() => {
    if (!enabled) return;

    const allowed = allowedKey ? allowedKey.split("|") : null;

    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path;
      if (
        allowed &&
        path &&
        !allowed.some((p) => path === p || path.startsWith(`${p}/`))
      ) {
        return;
      }
      onClose();
    };

    window.addEventListener("sidebar-main-page-click", handler);
    return () => window.removeEventListener("sidebar-main-page-click", handler);
  }, [onClose, enabled, allowedKey]);
}
