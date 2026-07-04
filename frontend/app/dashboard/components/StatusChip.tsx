"use client";

import { cn } from "@/app/utils/cn";

const STATUS_DOT: Record<string, string> = {
  PRESENT: "bg-emerald-500",
  LATE_MARK: "bg-amber-500",
  HALF_DAY: "bg-violet-500",
  ABSENT: "bg-rose-500",
  SINGLE_PUNCH: "bg-indigo-500",
  OT: "bg-teal-500",
  REGULARIZATION: "bg-purple-500",
  LEAVE: "bg-pink-500",
  WEEK_OFF: "bg-slate-400",
  HOLIDAY: "bg-sky-500",
};

const STATUS_CHIP: Record<string, string> = {
  PRESENT: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  LATE_MARK: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  HALF_DAY: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  ABSENT: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  SINGLE_PUNCH: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  OT: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  REGULARIZATION: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  LEAVE: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  WEEK_OFF: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  HOLIDAY: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

export function StatusChip({
  statusType,
  label,
  title,
}: {
  statusType: string;
  label: string;
  title?: string;
}) {
  const dot = STATUS_DOT[statusType] ?? "bg-muted-foreground";
  const chip = STATUS_CHIP[statusType] ?? "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
        chip,
      )}
      title={title}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", dot)} />
      {label}
    </span>
  );
}
