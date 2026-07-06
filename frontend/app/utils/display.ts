/** Format a field value for read-only detail views. */
export function displayValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const joined = value.filter(Boolean).join(", ");
    return joined || "—";
  }
  return String(value);
}
