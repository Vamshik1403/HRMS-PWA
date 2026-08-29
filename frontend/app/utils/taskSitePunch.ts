/** Site visit mark-in/out messages posted in task chat (not attendance punch). */

const SITE_MARK_IN = /site\s*mark\s*in\b/i;
const SITE_MARK_OUT = /site\s*mark\s*out\b/i;

const SITE_PUNCH_TASK_TYPES = new Set(["customer visit", "service"]);

/** Automated site visit check-in/out posts (not regular task chat). */
export const SITE_PUNCH_MESSAGE_RE =
  /\b(mark(?:ed)?\s*(in|out)|check(?:ed)?\s*(in|out)|site\s*(?:mark\s*)?(?:in|out))\b/i;

export function isSitePunchMessage(message?: string | null): boolean {
  return SITE_PUNCH_MESSAGE_RE.test((message || "").trim());
}

/** Customer Visit and SERVICE only. Internal Task and other types never get site punch. */
export function isSitePunchTaskType(type?: string | null): boolean {
  return SITE_PUNCH_TASK_TYPES.has((type || "").trim().toLowerCase());
}

export type SitePunchKind = "in" | "out";

export type SitePunchEvent = {
  kind: SitePunchKind;
  at: string;
  employeeName?: string | null;
  message?: string | null;
};

export function parseSitePunchKind(message?: string | null): SitePunchKind | null {
  const text = (message || "").trim();
  if (!text) return null;
  if (SITE_MARK_OUT.test(text)) return "out";
  if (SITE_MARK_IN.test(text)) return "in";
  return null;
}

export function listSitePunches(
  chats: { message?: string | null; createdAt?: string; senderName?: string | null }[] | undefined,
): SitePunchEvent[] {
  const ordered = [...(chats || [])].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  );
  const out: SitePunchEvent[] = [];
  for (const c of ordered) {
    const kind = parseSitePunchKind(c.message);
    if (!kind || !c.createdAt) continue;
    out.push({
      kind,
      at: c.createdAt,
      employeeName: c.senderName || null,
      message: c.message || null,
    });
  }
  return out;
}

export function sitePunchesFromTask(task: {
  sitePunches?: Array<{
    kind?: string;
    at?: string;
    createdAt?: string;
    senderName?: string | null;
    employeeName?: string | null;
    message?: string | null;
  }>;
  chats?: { message?: string | null; createdAt?: string; senderName?: string | null }[];
}): SitePunchEvent[] {
  const fromApi: SitePunchEvent[] = [];
  for (const p of task.sitePunches || []) {
    const kind = p.kind === "out" || p.kind === "in" ? p.kind : parseSitePunchKind(p.message);
    const at = p.at || p.createdAt;
    if (!kind || !at) continue;
    fromApi.push({
      kind,
      at,
      employeeName: p.employeeName || p.senderName || null,
      message: p.message || null,
    });
  }
  fromApi.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  if (fromApi.length) return fromApi;
  return listSitePunches(task.chats);
}

export function lastSitePunchByKind(
  punches: SitePunchEvent[],
  kind: SitePunchKind,
): SitePunchEvent | null {
  for (let i = punches.length - 1; i >= 0; i--) {
    if (punches[i].kind === kind) return punches[i];
  }
  return null;
}

export function formatSitePunchAt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Next punch alternates: none/OUT → IN, IN → OUT. */
export function getNextSitePunchKind(
  chats: { message?: string | null; createdAt?: string }[] | undefined,
): SitePunchKind {
  const punches = listSitePunches(chats);
  return punches[punches.length - 1]?.kind === "in" ? "out" : "in";
}

export function getNextSitePunchKindForTask(task: {
  sitePunches?: Array<{
    kind?: string;
    at?: string;
    createdAt?: string;
    senderName?: string | null;
    employeeName?: string | null;
    message?: string | null;
  }>;
  chats?: { message?: string | null; createdAt?: string }[];
}): SitePunchKind {
  const punches = sitePunchesFromTask(task);
  return punches[punches.length - 1]?.kind === "in" ? "out" : "in";
}

/** Stored chat text (parsers and reports depend on this wording). */
export function sitePunchLabel(kind: SitePunchKind) {
  return kind === "in" ? "Site Mark IN" : "Site Mark OUT";
}

/** Menu / button label shown to employees. */
export function sitePunchMenuLabel(kind: SitePunchKind) {
  return kind === "in" ? "Site check in" : "Site check out";
}
