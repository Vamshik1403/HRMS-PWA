import { cn } from "@/app/utils/cn";

/** Emergent-style list controls — theme-aware for light/dark admin shell. */
export const listControlClass = cn(
  "h-10 bg-background border border-input rounded-md shadow-none text-sm",
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
  "w-full bg-white border border-[#e5eeff] shadow-[0px_4px_20px_rgba(0,0,0,0.05)] rounded-xl text-card-foreground",
);
