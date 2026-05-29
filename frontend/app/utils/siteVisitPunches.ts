/** Extract mark-in / mark-out times from site visit task chat messages. */

export interface TaskChatLike {
  message: string;
  createdAt: string;
  senderName?: string | null;
}

export interface SiteVisitPunchTimes {
  markIn: string | null;
  markOut: string | null;
  markInMessage: string | null;
  markOutMessage: string | null;
}

const MARK_IN_RE =
  /\b(mark(?:ed)?\s*in|checked\s*in|arrived|reached\s*site|site\s*mark\s*in)\b/i;
const MARK_OUT_RE =
  /\b(mark(?:ed)?\s*out|checked\s*out|left\s*site|departed|site\s*mark\s*out)\b/i;

export function extractSiteVisitPunchesFromChats(chats: TaskChatLike[]): SiteVisitPunchTimes {
  let markIn: string | null = null;
  let markOut: string | null = null;
  let markInMessage: string | null = null;
  let markOutMessage: string | null = null;

  const sorted = [...chats].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const c of sorted) {
    const msg = (c.message || "").trim();
    if (!msg) continue;
    if (MARK_IN_RE.test(msg) && !markIn) {
      markIn = c.createdAt;
      markInMessage = msg;
    }
    if (MARK_OUT_RE.test(msg) && !markOut) {
      markOut = c.createdAt;
      markOutMessage = msg;
    }
  }

  return { markIn, markOut, markInMessage, markOutMessage };
}
