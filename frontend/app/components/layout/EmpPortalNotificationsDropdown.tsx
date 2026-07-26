"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Button } from "@/app/components/ui/button";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { authHeaders } from "@/lib/auth";
import { fetchBellBadgeCount, markBellNotificationsViewed } from "@/lib/empNotificationBadge";
import { getEmployeeIdFromStorage } from "@/lib/pushSubscribe";
import {
  consolidateStoredTaskChatNotifications,
  loadInAppNotifications,
  pruneStoredMemoNotifications,
  type StoredInAppNotification,
} from "@/app/utils/empInAppNotifications";
import { filterNotificationsForViewer } from "@/app/utils/empNotificationFilter";
import { formatManagerNotificationCopy } from "@/app/utils/empManagerDisplay";
import { empPayoutHrefForPeriod } from "@/app/utils/empPayslipApi";
import { EmpNotificationsHistoryModal } from "@/app/components/emp/EmpNotificationsHistoryModal";
import { cn } from "@/app/utils/cn";
import { refreshHomeScreenBadge } from "@/lib/empNotificationBadge";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const GROUP_SUBJECT_PREFIX = "IM_GROUP::";

type FeedNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  emoji: string;
  at: string;
  href?: string;
  subjectEmployeeId?: number;
  subjectEmployeeName?: string;
  isTeamItem?: boolean;
};

function cleanNotificationText(text: string | null | undefined) {
  const value = (text || "").trim();
  if (!value) return "";
  if (!value.includes(GROUP_SUBJECT_PREFIX)) return value;
  return value.replace(/IM_GROUP::[^\s:]+::/g, "Group · ");
}

function fmtWhen(iso: string, kind?: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const dayDiff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86400000,
  );
  if (kind === "holiday") {
    if (dayDiff === 0) return "Today";
    if (dayDiff === 1) return "Tomorrow";
  }
  if (dayDiff === 0) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function resolveNotificationHref(n: FeedNotification): string | undefined {
  if (!n.href) return undefined;
  if (n.kind === "payslip" && n.href === "/empPayout" && n.body) {
    const periodMatch = n.body.match(/for (.+?) is ready/i) || n.body.match(/for (.+?) has been paid/i);
    if (periodMatch?.[1]) return empPayoutHrefForPeriod(periodMatch[1].trim());
  }
  return n.href;
}

function collectMemoIds(items: FeedNotification[]): Set<number> {
  const ids = new Set<number>();
  for (const item of items) {
    if (item.kind !== "memo" || !item.id.startsWith("memo-")) continue;
    const id = Number(item.id.slice(5));
    if (Number.isFinite(id)) ids.add(id);
  }
  return ids;
}

function mergeFeeds(
  apiRecent: FeedNotification[],
  apiOlder: FeedNotification[],
  stored: StoredInAppNotification[],
): FeedNotification[] {
  const fromStored: FeedNotification[] = stored.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    body: s.body,
    emoji: s.emoji,
    at: s.at,
    href: s.href,
    subjectEmployeeId: s.subjectEmployeeId,
    subjectEmployeeName: s.subjectEmployeeName,
    isTeamItem: s.isTeamItem,
  }));
  const combined = [...fromStored, ...apiRecent, ...apiOlder];
  const seen = new Set<string>();
  const unique: FeedNotification[] = [];
  for (const item of combined.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

export function EmpPortalNotificationsDropdown() {
  const { scope, isManagerView } = useEmpManagerScope();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [badge, setBadge] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<FeedNotification[]>([]);
  const [older, setOlder] = useState<FeedNotification[]>([]);
  const [stored, setStored] = useState<StoredInAppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshBadge = useCallback(async () => {
    const employeeId = getEmployeeIdFromStorage();
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    if (!employeeId || !token) return;
    try {
      setBadge(await fetchBellBadgeCount(employeeId, token));
    } catch {
      setBadge(0);
    }
  }, []);

  const markViewedAndRefresh = useCallback(() => {
    markBellNotificationsViewed();
    setBadge(0);
    void refreshHomeScreenBadge();
    void refreshBadge();
  }, [refreshBadge]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/emp-notifications/feed?recentDays=7&olderDays=90`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        setRecent([]);
        setOlder([]);
        setError("Could not load notifications.");
      } else {
        const data = await res.json();
        const olderList = Array.isArray(data.older) ? data.older : [];
        const recentList = Array.isArray(data.recent) ? data.recent : [];
        pruneStoredMemoNotifications(collectMemoIds([...recentList, ...olderList]));
        setRecent(recentList);
        setOlder(olderList);
      }
      consolidateStoredTaskChatNotifications();
      setStored(loadInAppNotifications());
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshBadge();
    const onChange = () => {
      void refreshBadge();
      if (open) void loadFeed();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshBadge();
    };
    window.addEventListener("emp-notifications-changed", onChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("emp-notifications-changed", onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshBadge, loadFeed, open]);

  useEffect(() => {
    if (open) {
      markViewedAndRefresh();
      void loadFeed();
    }
  }, [open, loadFeed, markViewedAndRefresh]);

  const fullList = useMemo(() => {
    const merged = mergeFeeds(recent, older, stored);
    return filterNotificationsForViewer(merged, isManagerView).sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [recent, older, stored, isManagerView]);

  const preview = useMemo(() => fullList.slice(0, 8), [fullList]);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-5" strokeWidth={1.75} />
            {badge > 0 ? (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[360px] max-w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-[11px] text-muted-foreground">
                {isManagerView ? "Team updates" : "Your recent updates"}
              </p>
            </div>
            {fullList.length > preview.length ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  markViewedAndRefresh();
                  setOpen(false);
                  setHistoryOpen(true);
                }}
              >
                View all
              </Button>
            ) : null}
          </div>

          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            {loading && preview.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : error ? (
              <p className="px-4 py-8 text-center text-sm text-destructive">{error}</p>
            ) : preview.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 size-5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-muted-foreground">No notifications right now.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {preview.map((n) => {
                  const raw = isManagerView
                    ? formatManagerNotificationCopy(n, scope)
                    : { title: n.title, body: n.body };
                  const copy = {
                    title: cleanNotificationText(raw.title),
                    body: cleanNotificationText(raw.body),
                  };
                  const href = resolveNotificationHref(n);
                  const row = (
                    <div className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-base">
                        {n.emoji || "🔔"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-foreground">{copy.title}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {fmtWhen(n.at, n.kind)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{copy.body}</p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {href ? (
                        <Link href={href} onClick={() => setOpen(false)} className="block">
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {fullList.length > 0 ? (
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="ghost"
                className={cn("h-9 w-full justify-center text-xs font-semibold")}
                onClick={() => {
                  markViewedAndRefresh();
                  setOpen(false);
                  setHistoryOpen(true);
                }}
              >
                See all notifications
              </Button>
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <EmpNotificationsHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={fullList}
        isManagerView={isManagerView}
        scope={scope}
      />
    </>
  );
}
