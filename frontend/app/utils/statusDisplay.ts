/** User-facing status labels (DB may still store legacy "Partly Approved"). */

const PARTLY_LEGACY = /^partly\s+approved$/i;

export function displayStatusLabel(status?: string | null): string {
  const s = (status || "").trim();
  if (!s) return "Pending";
  if (PARTLY_LEGACY.test(s)) return "Partially Approved";
  return s;
}

export function isPartiallyApprovedStatus(status?: string | null): boolean {
  const s = (status || "").trim().toLowerCase();
  return s === "partly approved" || s === "partially approved";
}
