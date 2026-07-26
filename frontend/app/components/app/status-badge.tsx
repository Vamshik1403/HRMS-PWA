"use client";

import { cn } from "@/app/utils/cn";

/** Soft enterprise status pill used across admin tables. */
export function StatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const raw = (status || "").trim();
  const key = raw.toLowerCase();

  let tone =
    "bg-[#F3F4F6] text-[#4B5563] dark:bg-muted dark:text-muted-foreground";
  if (
    ["active", "approved", "accepted", "delivered", "completed", "paid", "present"].includes(
      key,
    )
  ) {
    tone = "bg-[#ECFDF5] text-[#16A34A] dark:bg-emerald-950/40 dark:text-emerald-400";
  } else if (
    ["pending", "processing", "in progress", "wip", "partial", "partly approved"].includes(key) ||
    key.includes("pending")
  ) {
    tone = "bg-[#FFFBEB] text-[#D97706] dark:bg-amber-950/40 dark:text-amber-400";
  } else if (
    ["shipped", "open", "info", "submitted"].includes(key)
  ) {
    tone = "bg-[#EFF6FF] text-[#2563EB] dark:bg-blue-950/40 dark:text-blue-400";
  } else if (
    ["inactive", "rejected", "cancelled", "canceled", "revoked", "absent", "failed"].includes(
      key,
    )
  ) {
    tone = "bg-[#FEF2F2] text-[#DC2626] dark:bg-rose-950/40 dark:text-rose-400";
  }

  if (!raw) return null;

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        tone,
        className,
      )}
    >
      {raw}
    </span>
  );
}
