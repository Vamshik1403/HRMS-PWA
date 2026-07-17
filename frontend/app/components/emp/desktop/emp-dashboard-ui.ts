/** Enterprise employee dashboard design tokens */
export const dashCard =
  "rounded-[20px] bg-white border border-[#E5E7EB] shadow-[0_8px_24px_rgba(15,23,42,0.05)]";

export const dashMetricCard = "rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] p-4";

export const dashGrid = "grid grid-cols-12 gap-6";

export const dashLabel =
  "text-[13px] font-semibold uppercase tracking-wide text-[#6B7280]";

export const dashTitle = "text-xl font-bold text-[#111827]";

export const dashMuted = "text-sm text-[#6B7280]";

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
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}
