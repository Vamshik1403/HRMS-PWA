"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, Gift, UserPlus, Wallet } from "lucide-react";
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

type AdminNotice = {
  id: string;
  title: string;
  body: string;
  href: string;
  icon: "leave" | "reimb" | "advance" | "birthday" | "join" | "task";
};

function readSeenFeed() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(VIEWED_FEED_KEY) || "";
}

function markFeedSeen(fingerprint: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIEWED_FEED_KEY, fingerprint);
  window.dispatchEvent(new Event("hrms-admin-notifications-changed"));
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

export function HrmsNotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminNotice[]>([]);
  const [seenFeed, setSeenFeed] = useState("");

  const refreshSeen = useCallback(() => {
    setSeenFeed(readSeenFeed());
  }, []);

  const load = useCallback(async () => {
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
  }, []);

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
    window.addEventListener("hrms-admin-notifications-changed", onChange);
    window.addEventListener("sidebar-context-changed", onChange);
    return () => {
      window.removeEventListener("hrms-admin-notifications-changed", onChange);
      window.removeEventListener("sidebar-context-changed", onChange);
    };
  }, [load, refreshSeen]);

  useEffect(() => {
    if (open) {
      markFeedSeen(fingerprint);
      refreshSeen();
      void load();
    }
  }, [open, fingerprint, load, refreshSeen]);

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
          <p className="text-[11px] text-muted-foreground">Company updates and pending actions</p>
        </div>
        <div className="max-h-[min(420px,60vh)] overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">No notifications right now.</p>
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
              <Link href="/leave-applications" onClick={() => setOpen(false)}>
                Review pending requests
              </Link>
            </Button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
