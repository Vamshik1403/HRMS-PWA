/** Display label for salary slip period (single month, not raw date range). */
export function formatPayslipPeriodLabel(
  monthLabel?: string | null,
  start?: Date | null,
  end?: Date | null,
): string {
  const label = (monthLabel || "").trim();
  if (label && !label.toLowerCase().includes(" to ")) {
    return label;
  }
  if (label.includes(" to ")) {
    const right = label.split(" to ").pop()?.trim() || "";
    const parts = right.split(/\s+/);
    if (parts.length >= 2) {
      const [day, month, year] = parts;
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const idx = months.findIndex(
        (m) => m.toLowerCase() === month?.toLowerCase(),
      );
      if (idx >= 0 && year) return `${months[idx]} ${year}`;
    }
  }
  const d = end || start;
  if (d && !Number.isNaN(d.getTime())) {
    return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
  }
  return label || "—";
}
