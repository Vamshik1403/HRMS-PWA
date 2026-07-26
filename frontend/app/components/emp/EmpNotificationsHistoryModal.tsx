"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Icon } from "@iconify/react";
import type { FeedNotification } from "./EmpNotificationsPanel";
import { empPayoutHrefForPeriod } from "../../utils/empPayslipApi";
import type { EmpManagerScope } from "../../utils/empManagerDisplay";
import { formatManagerNotificationCopy } from "../../utils/empManagerDisplay";

const GROUP_SUBJECT_PREFIX = "IM_GROUP::";

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
    const periodMatch =
      n.body.match(/for (.+?) is ready/i) || n.body.match(/for (.+?) has been paid/i);
    if (periodMatch?.[1]) return empPayoutHrefForPeriod(periodMatch[1].trim());
  }
  return n.href;
}

function cleanNotificationText(text: string | null | undefined) {
  const value = (text || "").trim();
  if (!value) return "";
  if (!value.includes(GROUP_SUBJECT_PREFIX)) return value;
  return value.replace(/IM_GROUP::[^\s:]+::/g, "Group · ");
}

function NotificationRow({
  n,
  isManagerView,
  scope,
  onNavigate,
}: {
  n: FeedNotification;
  isManagerView: boolean;
  scope: EmpManagerScope | null;
  onNavigate?: () => void;
}) {
  const raw = isManagerView
    ? formatManagerNotificationCopy(n, scope)
    : { title: n.title, body: n.body };
  const copy = {
    title: cleanNotificationText(raw.title),
    body: cleanNotificationText(raw.body),
  };
  const inner = (
    <div className="flex gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.99]">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
        {n.kind === "holiday" && /^\d{1,2} [A-Z][a-z]{2}$/.test(n.emoji) ? (
          <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
            <span className="text-[9px] font-semibold uppercase leading-none tracking-wide text-red-400">
              {n.emoji.split(" ")[1]}
            </span>
            <span className="mt-0.5 text-[14px] font-bold leading-none text-red-500">
              {n.emoji.split(" ")[0]}
            </span>
          </div>
        ) : (
          <span className="text-xl">{n.emoji}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-bold leading-snug text-foreground">{copy.title}</p>
          <span className="flex-shrink-0 text-[10px] text-muted-foreground">{fmtWhen(n.at, n.kind)}</span>
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{copy.body}</p>
      </div>
    </div>
  );
  const href = resolveNotificationHref(n);
  return href ? (
    <Link href={href} onClick={onNavigate}>
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

export function EmpNotificationsHistoryModal({
  open,
  onClose,
  items,
  isManagerView,
  scope,
}: {
  open: boolean;
  onClose: () => void;
  items: FeedNotification[];
  isManagerView: boolean;
  scope: EmpManagerScope | null;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emp-notifications-history-title"
    >
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
          aria-label="Close"
        >
          <Icon icon="solar:arrow-left-linear" className="h-5 w-5" />
        </button>
        <div>
          <h1 id="emp-notifications-history-title" className="text-[17px] font-bold text-foreground">
            All notifications
          </h1>
          <p className="text-[11px] text-muted-foreground">Last 90 days</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 pb-8">
        {items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-muted-foreground">No notifications</p>
        ) : (
          items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              isManagerView={isManagerView}
              scope={scope}
              onNavigate={onClose}
            />
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}
