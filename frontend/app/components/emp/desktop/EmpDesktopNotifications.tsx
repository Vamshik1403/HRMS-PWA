"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { DataTable, type DataTableColumn } from "../../app/data-table";
import { listCardClass } from "../../app/list-ui-styles";
import {
  consolidateStoredTaskChatNotifications,
  loadInAppNotifications,
  pruneStoredMemoNotifications,
  type StoredInAppNotification,
} from "../../../utils/empInAppNotifications";
import { empPayoutHrefForPeriod } from "../../../utils/empPayslipApi";
import { getEmployeeIdFromStorage } from "@/lib/pushSubscribe";
import { empNotifFeedCacheKey, getPageCache, setPageCache } from "../../../utils/pageCache";
import { useEmpManagerScope } from "../../../hooks/useEmpManagerScope";
import { formatManagerNotificationCopy } from "../../../utils/empManagerDisplay";
import { filterNotificationsForViewer } from "../../../utils/empNotificationFilter";
import { EmpNotificationsHistoryModal } from "../EmpNotificationsHistoryModal";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

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

type CachedFeed = { recent: FeedNotification[]; older: FeedNotification[]; hasMore: boolean };

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
  const dayDiff = Math.round((localDay(d).getTime() - localDay(now).getTime()) / 86400000);
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

function isWithinLastDays(iso: string, days: number) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - days * 86400000;
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

export function EmpDesktopNotifications() {
  const { scope, isManagerView } = useEmpManagerScope();
  const feedCacheKey =
    typeof window !== "undefined" ? empNotifFeedCacheKey(getEmployeeIdFromStorage()) : "empNotifFeed";
  const cached = typeof window !== "undefined" ? getPageCache<CachedFeed>(feedCacheKey) : null;
  const [recent, setRecent] = useState<FeedNotification[]>(cached?.recent ?? []);
  const [older, setOlder] = useState<FeedNotification[]>(cached?.older ?? []);
  const [stored, setStored] = useState<StoredInAppNotification[]>([]);
  const [loading, setLoading] = useState(!cached);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
    window.addEventListener("emp-notifications-changed", onChange);
    return () => window.removeEventListener("emp-notifications-changed", onChange);
  }, [load]);

  const fullList = useMemo(() => {
    const merged = mergeFeeds(recent, older, stored);
    return filterNotificationsForViewer(merged, isManagerView).sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [recent, older, stored, isManagerView]);

  const panelList = useMemo(
    () => fullList.filter((n) => isWithinLastDays(n.at, 7)).slice(0, 8),
    [fullList],
  );

  const columns: DataTableColumn<FeedNotification>[] = [
    {
      key: "title",
      header: "Notification",
      colSpan: 5,
      cell: (n) => {
        const copy = isManagerView
          ? formatManagerNotificationCopy(n, scope)
          : { title: n.title, body: n.body };
        return (
          <div className="min-w-0 py-1">
            <p className="font-medium text-foreground truncate">{copy.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{copy.body}</p>
          </div>
        );
      },
    },
    {
      key: "when",
      header: "When",
      colSpan: 2,
      cell: (n) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">{fmtWhen(n.at, n.kind)}</span>
      ),
    },
    {
      key: "action",
      header: "",
      colSpan: 1,
      align: "right",
      cell: (n) => {
        const href = resolveNotificationHref(n);
        return href ? (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
            <Link href={href}>Open</Link>
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
  ];

  return (
    <>
      <Card className={cn(listCardClass, "min-w-0 overflow-hidden")}>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Bell className="size-5 text-primary" />
              {isManagerView ? "Team notifications" : "Notifications"}
            </CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </div>
          {fullList.length > panelList.length ? (
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              View all
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          <DataTable
            columns={columns}
            rows={panelList}
            isLoading={loading}
            rowKey={(n) => n.id}
            emptyIcon={Bell}
            emptyTitle="No notifications"
            emptyDescription="You're all caught up for the last 7 days."
            fitContainer
          />
          {error ? <p className="text-sm text-destructive mt-3">{error}</p> : null}
        </CardContent>
      </Card>

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
