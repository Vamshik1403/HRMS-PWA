/** Convert an ISO datetime to a `datetime-local` input value in the browser's local zone. */
export function toDatetimeLocalValue(iso?: string | Date | null): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a `datetime-local` value to ISO UTC for storage and ENPL `dueAt`. */
export function toIsoFromDatetimeLocal(value?: string | null): string | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
