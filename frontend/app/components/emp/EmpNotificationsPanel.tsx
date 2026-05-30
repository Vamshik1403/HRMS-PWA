"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import {
  loadInAppNotifications,
  type StoredInAppNotification,
} from "../../utils/empInAppNotifications";
import { empPayoutHrefForPeriod } from "../../utils/empPayslipApi";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export type FeedNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  emoji: string;
  at: string;
  href?: string;
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

function mergeFeeds(
  apiRecent: FeedNotification[],
  apiOlder: FeedNotification[],
  stored: StoredInAppNotification[],
  showOlder: boolean,
): FeedNotification[] {
  const fromStored: FeedNotification[] = stored.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    body: s.body,
    emoji: s.emoji,
    at: s.at,
    href: s.href,
  }));
  const combined = [...fromStored, ...apiRecent, ...(showOlder ? apiOlder : [])];
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
  const [recent, setRecent] = useState<FeedNotification[]>([]);
  const [older, setOlder] = useState<FeedNotification[]>([]);
  const [stored, setStored] = useState<StoredInAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOlder, setShowOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
        setHasMore(false);
        setError("Could not load notifications.");
      } else {
        const data = await res.json();
        const olderList = Array.isArray(data.older) ? data.older : [];
        setRecent(Array.isArray(data.recent) ? data.recent : []);
        setOlder(olderList);
        setHasMore(Boolean(data.hasMore) || olderList.length > 0);
      }
      setStored(loadInAppNotifications());
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => {
      setStored(loadInAppNotifications());
      void load();
    };
    window.addEventListener("emp-notifications-changed", onChange);
    return () => window.removeEventListener("emp-notifications-changed", onChange);
  }, [load]);

  const list = useMemo(
    () => mergeFeeds(recent, older, stored, showOlder),
    [recent, older, stored, showOlder],
  );

  const recentOnly = useMemo(
    () => mergeFeeds(recent, [], stored, false),
    [recent, stored],
  );

  const display = showOlder ? list : recentOnly;

  const fullList = useMemo(
    () => mergeFeeds(recent, older, stored, true),
    [recent, older, stored],
  );

  const hasOlder =
    hasMore || older.length > 0 || fullList.length > recentOnly.length;

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-gray-900">Notifications</h2>
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
      ) : display.length === 0 && !hasOlder ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-2">
          <span className="text-2xl" aria-hidden>
            🔔
          </span>
          <p className="text-[12px] text-gray-400">No notifications in the last 7 days</p>
        </div>
      ) : display.length === 0 ? null : (
        <div className="space-y-2">
          {display.map((n) => {
            const inner = (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_8px_rgba(15,23,42,0.04)] px-3.5 py-3 flex gap-3 active:scale-[0.99] transition-transform">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
                  {n.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold text-gray-900 leading-snug">{n.title}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtWhen(n.at, n.kind)}</span>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">{n.body}</p>
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

      {!loading && !error && !showOlder && hasOlder && (
        <button
          type="button"
          onClick={() => setShowOlder(true)}
          className="mt-3 w-full py-2.5 text-[13px] font-bold text-[#2563eb] bg-white border border-gray-100 rounded-xl shadow-sm active:scale-[0.99]"
        >
          View more
        </button>
      )}
      {showOlder && (
        <p className="mt-2 text-center text-[11px] text-gray-400">Showing older notifications (up to 90 days)</p>
      )}
    </div>
  );
}