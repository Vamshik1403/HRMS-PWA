/** Site visit mark-in/out messages posted in task chat. */

const SITE_MARK_IN = /site\s*mark\s*in\b/i;
const SITE_MARK_OUT = /site\s*mark\s*out\b/i;

export type SitePunchKind = "in" | "out";

export function parseSitePunchKind(message?: string | null): SitePunchKind | null {
  const text = (message || "").trim();
  if (!text) return null;
  if (SITE_MARK_OUT.test(text)) return "out";
  if (SITE_MARK_IN.test(text)) return "in";
  return null;
}

/** Next punch alternates: none/OUT → IN, IN → OUT. */
export function getNextSitePunchKind(
  chats: { message?: string | null; createdAt?: string }[] | undefined,
): SitePunchKind {
  const ordered = [...(chats || [])].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  );
  let last: SitePunchKind | null = null;
  for (const c of ordered) {
    const kind = parseSitePunchKind(c.message);
    if (kind) last = kind;
  }
  return last === "in" ? "out" : "in";
}

export function sitePunchLabel(kind: SitePunchKind) {
  return kind === "in" ? "Site Mark IN" : "Site Mark OUT";
}
