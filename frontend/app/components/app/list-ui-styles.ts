import { cn } from "@/app/utils/cn";

/** Enterprise SaaS list controls — shared across all admin data tables. */
export const listControlClass = cn(
  "h-[46px] bg-card border border-[#E5E7EB] dark:border-border rounded-xl shadow-none text-sm text-foreground",
  "ring-offset-background placeholder:text-muted-foreground/70",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-1",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "transition-colors",
);

export const listSelectTriggerClass = cn(
  listControlClass,
  "flex w-full items-center justify-between gap-2 px-4",
  "data-[placeholder]:text-muted-foreground",
);

export const listIconButtonClass = cn(
  "inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] dark:border-border bg-card text-muted-foreground",
  "transition-colors hover:bg-muted hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
);

export const listPrimaryButtonClass = cn(
  "inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground",
  "shadow-sm transition-all hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99]",
);

export const listCardClass = cn(
  "w-full overflow-hidden rounded-2xl border border-[#E8EDF5] dark:border-border bg-card text-card-foreground",
  "shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
);

export const listToolbarClass = cn(
  "flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-3",
);
