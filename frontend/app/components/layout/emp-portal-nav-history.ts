"use client";

import type { EmpSidebarNavItem } from "./emp-portal-sidebar-navigation";
import {
  EMP_SIDEBAR_NAVIGATION,
  isEmpNavItemActive,
} from "./emp-portal-sidebar-navigation";

export type EmpNavHistoryEntry = {
  url: string;
  sectionId: string;
};

const MAX_STACK = 60;

/** In-memory visit stack for Gmail-style sidebar re-click back navigation. */
let stack: EmpNavHistoryEntry[] = [];
/** Skip the next pathname record (we navigated via an intentional pop). */
let suppressNextRecord = false;

export function fullPortalUrl(pathname: string, search = ""): string {
  if (!search || search === "?") return pathname;
  return `${pathname}${search.startsWith("?") ? search : `?${search}`}`;
}

export function getSidebarItemId(item: EmpSidebarNavItem): string {
  return item.id;
}

export function findActiveSidebarItem(
  pathname: string,
  searchParams: URLSearchParams,
  items: EmpSidebarNavItem[] = EMP_SIDEBAR_NAVIGATION.flatMap((g) => g.items),
): EmpSidebarNavItem | null {
  for (const item of items) {
    if (isEmpNavItemActive(item, pathname, searchParams)) return item;
  }
  return null;
}

export function markNavHistorySuppress() {
  suppressNextRecord = true;
}

/**
 * Record leaving `fromUrl` when the portal location changes.
 * Called from EmpPortalShell on pathname/search updates.
 */
export function recordPortalNavigation(
  fromUrl: string,
  toUrl: string,
  fromSectionId: string,
) {
  if (!fromUrl || !toUrl || fromUrl === toUrl) return;
  if (suppressNextRecord) {
    suppressNextRecord = false;
    return;
  }
  const top = stack[stack.length - 1];
  if (top?.url === fromUrl) return;
  stack.push({ url: fromUrl, sectionId: fromSectionId || "unknown" });
  if (stack.length > MAX_STACK) stack.splice(0, stack.length - MAX_STACK);
}

/**
 * Pop the previous location when the user re-clicks the active sidebar item.
 * Only steps back within the same sidebar section — never jumps to another section
 * (e.g. Branches → Employees → re-click Employees must not return to Branches).
 * Returns null when there is no same-section history (caller should refresh / close panels).
 */
export function popPortalNavHistory(
  currentUrl: string,
  currentSectionId?: string,
): string | null {
  const skipped: EmpNavHistoryEntry[] = [];

  while (stack.length > 0) {
    const entry = stack.pop()!;
    if (currentSectionId && entry.sectionId !== currentSectionId) {
      // Preserve other sections' history for their own sidebar re-clicks.
      skipped.push(entry);
      continue;
    }
    if (entry.url && entry.url !== currentUrl) {
      // Restore skipped (other-section) entries in original order.
      for (let i = skipped.length - 1; i >= 0; i--) {
        stack.push(skipped[i]);
      }
      suppressNextRecord = true;
      return entry.url;
    }
  }

  for (let i = skipped.length - 1; i >= 0; i--) {
    stack.push(skipped[i]);
  }
  return null;
}

/** Test/reset helper — not used in production UI. */
export function resetPortalNavHistory() {
  stack = [];
  suppressNextRecord = false;
}
