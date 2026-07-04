import type { ReactNode } from "react";
import { cn } from "@/app/utils/cn";

/** Premium borderless card shell — shadow over borders. */
export const cardShell =
  "rounded-xl border-0 bg-card text-card-foreground shadow-[0_1px_3px_rgba(0,0,0,0.05),0_8px_24px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]";

export const cardShellFlat =
  "rounded-xl border-0 bg-card text-card-foreground shadow-[0_1px_3px_rgba(0,0,0,0.05)]";

export const panelTitle =
  "text-xl font-semibold tracking-tight text-foreground";

export const panelSubtitle = "text-[13px] text-muted-foreground mt-1";

export const sectionGap = "space-y-8";

export const gridGap = "gap-6 lg:gap-8";

export const filterSelectClass =
  "rounded-md border border-input bg-muted/40 px-3 py-2 text-xs font-medium text-foreground min-w-[140px] focus:outline-none focus:ring-2 focus:ring-ring/25 transition-colors";

export const actionTileClass =
  "group flex items-center gap-3 rounded-lg border-0 bg-card px-4 py-3.5 text-sm font-medium text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-150";

export const actionTileStackClass =
  "group flex flex-col items-center justify-center gap-2 rounded-lg border-0 bg-card px-4 py-4 text-xs font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] text-center min-h-[5rem] transition-all duration-150";

export const listItemClass =
  "block rounded-md border-0 bg-muted/40 px-4 py-3 hover:bg-muted/70 transition-colors duration-150";

export const iconTileClass =
  "size-11 rounded-md bg-primary/10 flex items-center justify-center shrink-0";

export function DashboardSection({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <section className={cn(cardShell, "p-7 sm:p-8", className)}>{children}</section>;
}
