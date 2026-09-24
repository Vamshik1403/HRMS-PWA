"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Bell, CalendarClock, Gift, HardDrive, Server, Shield, UserPlus, Wallet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Button } from "@/app/components/ui/button";
import { authHeaders } from "@/lib/auth";
import { getSidebarContext } from "@/app/utils/sidebarContext";
import { cn } from "@/app/utils/cn";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
const VIEWED_FEED_KEY = "_hrms_admin_bell_feed";
const SUPERADMIN_FEED_KEY = "_hrms_superadmin_bell_feed";

type NoticeIcon = "leave" | "reimb" | "advance" | "birthday" | "join" | "task" | "health" | "storage" | "backend" | "security" | "api";

type AdminNotice = {
  id: string;
  title: string;
  body: string;
  href: string;
  icon: NoticeIcon;
};

const SYSTEM_ALERTS: Record<string, Omit<AdminNotice, "id">> = {
  HIGH_CPU: {
    title: "High CPU",
    body: "Processor use is above 85%.",
    href: "/superdashboard",
    icon: "health",
  },
  HIGH_MEMORY: {
    title: "High memory",
    body: "Memory use is above 85%.",
    href: "/superdashboard",
    icon: "health",
  },
  HIGH_DISK: {
    title: "Storage nearly full",
    body: "Disk use is above 85%.",
    href: "/superdashboard",
    icon: "storage",
  },
  HIGH_DB_CONNECTIONS: {
    title: "Database connections high",
    body: "The database is using most of its connections.",
    href: "/superdashboard",
    icon: "health",
  },
  LONG_RUNNING_DB_QUERIES: {
    title: "Slow database queries",
    body: "A query has been running for more than 30 seconds.",
    href: "/superdashboard",
    icon: "health",
  },
  BLOCKED_DB_QUERIES: {
    title: "Blocked database queries",
    body: "Queries are waiting on database locks.",
    href: "/superdashboard",
    icon: "health",
  },
  BACKEND_OFFLINE: {
    title: "Backend is down",
    body: "The API process is not online.",
    href: "/superdashboard",
    icon: "backend",
  },
  FRONTEND_OFFLINE: {
    title: "Frontend is down",
    body: "The site process is not online.",
    href: "/superdashboard",
    icon: "backend",
  },
  NGINX_INACTIVE: {
    title: "Web server is down",
    body: "Nginx is not active.",
    href: "/superdashboard",
    icon: "backend",
  },
  FIREWALL_INACTIVE: {
    title: "Firewall is off",
    body: "The security firewall is not active.",
    href: "/superdashboard",
    icon: "security",
  },
  HIGH_SSH_FAILED_LOGINS: {
    title: "Possible security issue",
    body: "Many failed SSH logins were recorded.",
    href: "/superdashboard",
    icon: "security",
  },
};

function feedKey(superAdmin: boolean) {
  return superAdmin ? SUPERADMIN_FEED_KEY : VIEWED_FEED_KEY;
}

function readSeenFeed(superAdmin: boolean) {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(feedKey(superAdmin)) || "";
}

function markFeedSeen(superAdmin: boolean, fingerprint: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(feedKey(superAdmin), fingerprint);
  window.dispatchEvent(new Event("hrms-admin-notifications-changed"));
}

function systemNotices(metrics: any, maps: any): AdminNotice[] {
  const next: AdminNotice[] = [];
  const codes: string[] = Array.isArray(metrics?.health?.alerts) ? metrics.health.alerts : [];
  for (const code of codes) {
    const copy = SYSTEM_ALERTS[code];
    if (!copy) continue;
    next.push({ id: code, ...copy });
  }
  if (!codes.includes("HIGH_DISK")) {
    const disks = Array.isArray(metrics?.disk?.all) ? metrics.disk.all : [];
    const hot = disks.filter((disk: any) => Number(disk?.usagePercent) >= 85);
    if (hot.length) {
      const names = hot.map((disk: any) => disk.mount || disk.filesystem || "disk").join(", ");
      next.push({
        id: `disk-${names}`,
        title: "Storage nearly full",
        body: `${names} is above 85% full.`,
        href: "/superdashboard",
        icon: "storage",
      });
    }
  }
  const backendErrors = Number(metrics?.logs?.backendErrorsLast500Lines ?? 0);
  if (backendErrors > 0) {
    next.push({
      id: `backend-errors-${backendErrors}`,
      title: "Backend errors",
      body: `${backendErrors} error${backendErrors === 1 ? "" : "s"} in recent API logs.`,
      href: "/superdashboard",
      icon: "backend",
    });
  }
  const nginxErrors = Number(metrics?.logs?.nginxErrorsLast1000Lines ?? 0);
  if (nginxErrors > 0) {
    next.push({
      id: `nginx-errors-${nginxErrors}`,
      title: "Web server errors",
      body: `${nginxErrors} error${nginxErrors === 1 ? "" : "s"} in recent Nginx logs.`,
      href: "/superdashboard",
      icon: "backend",
    });
  }
  if (metrics?.security?.fail2ban && metrics.security.fail2ban !== "active") {
    next.push({
      id: "fail2ban-inactive",
      title: "Security protection is off",
      body: "Fail2ban is not active.",
      href: "/superdashboard",
      icon: "security",
    });
  }
  if (maps && maps.configured === false) {
    next.push({
      id: "maps-not-configured",
      title: "Google Maps API is not configured",
      body: "The server key is missing, so address search cannot call Google.",
      href: "/system-apis/google-maps",
      icon: "api",
    });
  } else if (maps?.quotaPercent != null && Number(maps.quotaPercent) >= 80) {
    next.push({
      id: `maps-quota-${maps.quotaPercent}`,
      title: "API usage is high",
      body: `Google Maps has used ${maps.quotaPercent}% of this month's quota.`,
      href: "/system-apis/google-maps",
      icon: "api",
    });
  }
  return next;
}

function iconFor(kind: AdminNotice["icon"]) {
  switch (kind) {
    case "leave":
      return <CalendarClock className="size-4 text-amber-600 dark:text-amber-400" />;
    case "reimb":
    case "advance":
      return <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />;
    case "birthday":
      return <Gift className="size-4 text-pink-600 dark:text-pink-400" />;
    case "join":
      return <UserPlus className="size-4 text-blue-600 dark:text-blue-400" />;
    case "health":
      return <Activity className="size-4 text-amber-600 dark:text-amber-400" />;
    case "storage":
      return <HardDrive className="size-4 text-amber-600 dark:text-amber-400" />;
    case "backend":
      return <Server className="size-4 text-red-600 dark:text-red-400" />;
    case "security":
      return <Shield className="size-4 text-red-600 dark:text-red-400" />;
    case "api":
      return <Activity className="size-4 text-blue-600 dark:text-blue-400" />;
    default:
      return <Bell className="size-4 text-primary" />;
  }
}

function companyQuery() {
  const ctx = getSidebarContext();
  const stored =
    typeof window !== "undefined"
      ? Number(sessionStorage.getItem("activeCompanyID") || 0)
      : 0;
  const companyID = Number(ctx?.companyID || stored || 0);
  return companyID ? `?companyID=${companyID}` : "";
}

export function HrmsNotificationsDropdown({ user }: { user?: { role?: string } | null }) {
  const isSuperAdmin = String(user?.role || "").toUpperCase() === "SUPERADMIN";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminNotice[]>([]);
  const [seenFeed, setSeenFeed] = useState("");

  const refreshSeen = useCallback(() => {
    setSeenFeed(readSeenFeed(isSuperAdmin));
  }, [isSuperAdmin]);

  const loadSystem = useCallback(async () => {
    setLoading(true);
    try {
      const [liveRes, mapsRes] = await Promise.all([
        fetch(`${BACKEND}/system-dashboard/live`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${BACKEND}/external-apis/google-maps`, { headers: authHeaders(), cache: "no-store" }),
      ]);
      if (!liveRes.ok) {
        setItems([
          {
            id: "metrics-unavailable",
            title: "System health unavailable",
            body: "Live system metrics could not be loaded.",
            href: "/superdashboard",
            icon: "health",
          },
        ]);
        return;
      }
      const metrics = await liveRes.json();
      const maps = mapsRes.ok ? await mapsRes.json().catch(() => null) : null;
      setItems(systemNotices(metrics, maps));
    } catch {
      setItems([
        {
          id: "metrics-unavailable",
          title: "System health unavailable",
          body: "Live system metrics could not be loaded.",
          href: "/superdashboard",
          icon: "health",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!user?.role) return;
    if (isSuperAdmin) {
      await loadSystem();
      return;
    }
    setLoading(true);
    try {
      const qs = companyQuery();
      const res = await fetch(`${BACKEND}/dashboard-overview/hr-widgets${qs}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = await res.json();
      const next: AdminNotice[] = [];
      const pending = data?.pendingCounts || {};

      if ((pending.leave ?? 0) > 0) {
        next.push({
          id: `pending-leave-${pending.leave}`,
          title: "Leave requests pending",
          body: `${pending.leave} request${pending.leave === 1 ? "" : "s"} awaiting review`,
          href: "/leave-applications",
          icon: "leave",
        });
      }
      if ((pending.reimbursement ?? 0) > 0) {
        next.push({
          id: `pending-reimb-${pending.reimbursement}`,
          title: "Reimbursements pending",
          body: `${pending.reimbursement} claim${pending.reimbursement === 1 ? "" : "s"} awaiting review`,
          href: "/reimbursement",
          icon: "reimb",
        });
      }
      if ((pending.salaryAdvance ?? 0) > 0) {
        next.push({
          id: `pending-advance-${pending.salaryAdvance}`,
          title: "Salary advances pending",
          body: `${pending.salaryAdvance} request${pending.salaryAdvance === 1 ? "" : "s"} awaiting review`,
          href: "/salary-advance",
          icon: "advance",
        });
      }

      for (const ev of Array.isArray(data?.upcomingEvents) ? data.upcomingEvents : []) {
        next.push({
          id: String(ev.id || `ev-${ev.label}`),
          title: ev.kind === "birthday" ? "Upcoming birthday" : "Work anniversary",
          body: `${ev.label || "Team member"} · ${ev.when || "Soon"}`,
          href: "/manage-employees",
          icon: "birthday",
        });
      }

      for (const n of Array.isArray(data?.newsFeed) ? data.newsFeed : []) {
        next.push({
          id: String(n.id || `news-${n.title}`),
          title: n.title || "Company update",
          body: n.subtitle || n.date || "",
          href: "/manage-employees",
          icon: n.kind === "onboarding" ? "join" : "task",
        });
      }

      setItems(next.slice(0, 12));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, loadSystem, user?.role]);

  const fingerprint = useMemo(
    () => items.map((i) => i.id).sort().join("|"),
    [items],
  );

  useEffect(() => {
    refreshSeen();
    void load();
    const onChange = () => {
      refreshSeen();
      void load();
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("hrms-admin-notifications-changed", onChange);
    window.addEventListener("sidebar-context-changed", onChange);
    window.addEventListener("hrms-open-admin-notifications", onOpen);
    return () => {
      window.removeEventListener("hrms-admin-notifications-changed", onChange);
      window.removeEventListener("sidebar-context-changed", onChange);
      window.removeEventListener("hrms-open-admin-notifications", onOpen);
    };
  }, [load, refreshSeen]);

  useEffect(() => {
    if (open) {
      markFeedSeen(isSuperAdmin, fingerprint);
      refreshSeen();
      void load();
    }
  }, [open, fingerprint, load, refreshSeen, isSuperAdmin]);

  const badge = fingerprint && fingerprint !== seenFeed ? items.length : 0;

  return (
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
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          <p className="text-[11px] text-muted-foreground">
            {isSuperAdmin ? "System health, security, and API alerts" : "Company updates and pending actions"}
          </p>
        </div>
        <div className="max-h-[min(420px,60vh)] overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isSuperAdmin ? "No system alerts." : "No notifications right now."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {iconFor(n.icon)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{n.body}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              className={cn("h-9 w-full justify-center text-xs font-semibold")}
              asChild
            >
              <Link href={isSuperAdmin ? "/superdashboard" : "/leave-applications"} onClick={() => setOpen(false)}>
                {isSuperAdmin ? "Open system dashboard" : "Review pending requests"}
              </Link>
            </Button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
