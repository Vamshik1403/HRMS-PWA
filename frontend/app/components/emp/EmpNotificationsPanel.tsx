"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import {
  consolidateStoredTaskChatNotifications,
  loadInAppNotifications,
  pruneStoredMemoNotifications,
  type StoredInAppNotification,
} from "../../utils/empInAppNotifications";
import { empPayoutHrefForPeriod } from "../../utils/empPayslipApi";
import { getEmployeeIdFromStorage } from "@/lib/pushSubscribe";
import {
  empNotifFeedCacheKey,
  getPageCache,
  setPageCache,
} from "../../utils/pageCache";
import { useEmpManagerScope } from "../../hooks/useEmpManagerScope";
import { formatManagerNotificationCopy } from "../../utils/empManagerDisplay";
import { filterNotificationsForViewer } from "../../utils/empNotificationFilter";
import { EMP_MOBILE_PREVIEW_LIMIT } from "../../utils/empListLimit";
import { EmpNotificationsHistoryModal } from "./EmpNotificationsHistoryModal";
import { EmpListViewMoreButton } from "./EmpListViewMoreButton";

type CachedFeed = { recent: FeedNotification[]; older: FeedNotification[]; hasMore: boolean };

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export type FeedNotification = {
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

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function localDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmtWhen(iso: string, kind?: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const dayDiff = Math.round(
    (localDay(d).getTime() - localDay(now).getTime()) / 86400000,
  );

  if (kind === "holiday") {
    if (dayDiff === 0) return "Today";
    if (dayDiff === 1) return "Tomorrow";
  }

  const sameDay = dayDiff === 0;
  if (sameDay) {
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
    const periodMatch =
      n.body.match(/for (.+?) is ready/i) ||
      n.body.match(/for (.+?) has been paid/i);
    if (periodMatch?.[1]) {
      return empPayoutHrefForPeriod(periodMatch[1].trim());
    }
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

function isWithinLastDays(iso: string, days: number): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const cutoff = Date.now() - days * 86400000;
  return t >= cutoff;
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
  for (const item of combined.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

export function EmpNotificationsPanel() {
  const { scope, isManagerView } = useEmpManagerScope();
  const feedCacheKey =
    typeof window !== "undefined"
      ? empNotifFeedCacheKey(getEmployeeIdFromStorage())
      : "empNotifFeed";
  const cached =
    typeof window !== "undefined" ? getPageCache<CachedFeed>(feedCacheKey) : null;
  const [recent, setRecent] = useState<FeedNotification[]>(cached?.recent ?? []);
  const [older, setOlder] = useState<FeedNotification[]>(cached?.older ?? []);
  const [stored, setStored] = useState<StoredInAppNotification[]>([]);
  const [loading, setLoading] = useState(!cached);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading((prev) => prev && true);
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
        const apiMemoIds = collectMemoIds([...recentList, ...olderList]);
        pruneStoredMemoNotifications(apiMemoIds);
        setRecent(recentList);
        setOlder(olderList);
        setPageCache(feedCacheKey, {
          recent: recentList,
          older: olderList,
          hasMore: Boolean(data.hasMore) || olderList.length > 0,
        });
      }
      consolidateStoredTaskChatNotifications();
      setStored(loadInAppNotifications());
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [feedCacheKey]);

  useEffect(() => {
    void load();
    const onChange = () => {
      consolidateStoredTaskChatNotifications();
      setStored(loadInAppNotifications());
      void load();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("emp-notifications-changed", onChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("emp-notifications-changed", onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const fullList = useMemo(() => {
    const merged = mergeFeeds(recent, older, stored);
    return filterNotificationsForViewer(merged, isManagerView).sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [recent, older, stored, isManagerView]);

  const panelList = useMemo(() => {
    const merged = mergeFeeds(recent, [], stored);
    return filterNotificationsForViewer(merged, isManagerView)
      .filter((n) => isWithinLastDays(n.at, 7))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, EMP_MOBILE_PREVIEW_LIMIT);
  }, [recent, stored, isManagerView]);

  const olderCount = useMemo(() => {
    const merged = mergeFeeds(recent, [], stored);
    const within7 = filterNotificationsForViewer(merged, isManagerView).filter((n) =>
      isWithinLastDays(n.at, 7),
    );
    return Math.max(0, within7.length - EMP_MOBILE_PREVIEW_LIMIT);
  }, [recent, stored, isManagerView]);

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-gray-900">
          {isManagerView ? "Team notifications" : "Notifications"}
        </h2>
        <span className="text-[11px] text-gray-400">Last 7 days</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex justify-center">
          <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-[13px] text-gray-500">
          {error}
        </div>
      ) : panelList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-2">
          <span className="text-2xl" aria-hidden>
            🔔
          </span>
          <p className="text-[12px] text-gray-400">No notifications in the last 7 days</p>
        </div>
      ) : (
        <div className="space-y-2">
          {panelList.map((n) => {
            const copy = isManagerView
              ? formatManagerNotificationCopy(n, scope)
              : { title: n.title, body: n.body };
            const inner = (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_8px_rgba(15,23,42,0.04)] px-3.5 py-3 flex gap-3 active:scale-[0.99] transition-transform">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {n.kind === "holiday" && /^\d{1,2} [A-Z][a-z]{2}$/.test(n.emoji) ? (
                    <div className="flex flex-col items-center justify-center w-full h-full bg-red-50 rounded-xl border border-red-100">
                      <span className="text-[9px] font-semibold text-red-400 uppercase leading-none tracking-wide">
                        {n.emoji.split(" ")[1]}
                      </span>
                      <span className="text-[14px] font-bold text-red-600 leading-none mt-0.5">
                        {n.emoji.split(" ")[0]}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xl">{n.emoji}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold text-gray-900 leading-snug">{copy.title}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtWhen(n.at, n.kind)}</span>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">{copy.body}</p>
                </div>
              </div>
            );
            const href = resolveNotificationHref(n);
            return href ? (
              <Link key={n.id} href={href}>
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}

      {!loading && !error && olderCount > 0 && (
        <EmpListViewMoreButton
          count={olderCount}
          onClick={() => setHistoryOpen(true)}
          label="View more"
        />
      )}

      <EmpNotificationsHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={fullList}
        isManagerView={isManagerView}
        scope={scope}
      />
    </div>
  );
}
