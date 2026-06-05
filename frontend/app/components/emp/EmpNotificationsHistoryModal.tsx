"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import type { FeedNotification } from "./EmpNotificationsPanel";
import { empPayoutHrefForPeriod } from "../../utils/empPayslipApi";
import type { EmpManagerScope } from "../../utils/empManagerDisplay";
import { formatManagerNotificationCopy } from "../../utils/empManagerDisplay";

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

function NotificationRow({
  n,
  isManagerView,
  scope,
}: {
  n: FeedNotification;
  isManagerView: boolean;
  scope: EmpManagerScope | null;
}) {
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
    <Link href={href}>{inner}</Link>
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[240] flex flex-col bg-[#f8f9fb]">
      <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          aria-label="Close"
        >
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-[17px] font-bold text-gray-900">All notifications</h1>
          <p className="text-[11px] text-gray-500">Last 90 days</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 pb-8">
        {items.length === 0 ? (
          <p className="text-center text-[13px] text-gray-400 py-12">No notifications</p>
        ) : (
          items.map((n) => (
            <NotificationRow key={n.id} n={n} isManagerView={isManagerView} scope={scope} />
          ))
        )}
      </div>
    </div>
  );
}
