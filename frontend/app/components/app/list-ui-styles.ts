import { cn } from "@/app/utils/cn";

/** Emergent-style white controls for list-page search & filters. */
export const listControlClass = cn(
  "h-10 bg-white border border-input rounded-md shadow-none text-sm",
  "ring-offset-background placeholder:text-muted-foreground/70",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "transition-colors",
);

export const listSelectTriggerClass = cn(
  listControlClass,
  "flex w-full items-center justify-between gap-2 px-3 py-2",
  "data-[placeholder]:text-muted-foreground",
);

export const listCardClass = cn(
  "w-full bg-white border border-border shadow-sm rounded-xl text-card-foreground",
);
