/** Enterprise employee dashboard design tokens */
export const dashCard =
  "rounded-[20px] bg-card border border-border shadow-sm text-card-foreground";

export const dashMetricCard = "rounded-2xl bg-muted/40 border border-border p-4";

export const dashGrid = "grid grid-cols-12 gap-6";

export const dashLabel =
  "text-[13px] font-semibold uppercase tracking-wide text-muted-foreground";

export const dashTitle = "text-xl font-bold text-foreground";

export const dashMuted = "text-sm text-muted-foreground";

export function dashGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good Morning";
  if (h >= 12 && h < 17) return "Good Afternoon";
  if (h >= 17 && h < 20) return "Good Evening";
  return "Good Night";
}

export type DayPhase = "morning" | "afternoon" | "evening" | "night";

export function dayPhase(): DayPhase {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}
