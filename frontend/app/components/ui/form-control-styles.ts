import { cn } from "@/app/utils/cn";

/** Shared premium form control surface — 48px height, 12px radius, 150ms transitions */
export const formControlClass = cn(
  "flex w-full rounded-xl border border-[#E2E8F0] bg-background text-sm text-foreground",
  "px-3.5 transition-all duration-150",
  "placeholder:text-muted-foreground",
  "hover:border-[#CBD5E1]",
  "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
);

export const formInputClass = cn(formControlClass, "h-12");

export const formTextareaClass = cn(
  formControlClass,
  "min-h-[120px] py-3 resize-y",
);

export const formSelectTriggerClass = cn(
  formInputClass,
  "items-center justify-between gap-2",
  "data-[placeholder]:text-muted-foreground",
);

export const formDropdownClass = cn(
  "z-50 overflow-hidden rounded-xl border border-[#E2E8F0] bg-popover text-popover-foreground shadow-lg",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "data-[side=bottom]:slide-in-from-top-1",
);

export const formDropdownItemClass = cn(
  "relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none transition-colors",
  "hover:bg-[#F8FAFC] focus:bg-[#F8FAFC] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);
