const KNOWN_API_MESSAGES: Record<string, string> = {
  MODULE_NOT_SUBSCRIBED: "This module is not included in your company's subscription.",
  MODULE_ACCESS_DENIED: "You do not have permission for this action.",
  NO_ACTIVE_SUBSCRIPTION:
    "No subscription added or assigned. Contact the application's administrator.",
  SUBSCRIPTION_EXPIRED:
    "Your subscription has expired. Please contact the application's administrator.",
};

function statusSentence(status: number): string | null {
  if (status === 402) return "This action was rejected (402 Payment Required).";
  if (status === 403) return "You do not have permission for this action.";
  return null;
}

export function humanizeApiMessage(raw: unknown, status?: number): string {
  if (Array.isArray(raw)) {
    const parts = raw.map((item) => humanizeApiMessage(item)).filter(Boolean);
    if (parts.length) return parts.join(", ");
  }

  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return statusSentence(status ?? 0) || "";
  if (KNOWN_API_MESSAGES[text]) return KNOWN_API_MESSAGES[text];

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      const fromBody = humanizeApiMessage(parsed?.message ?? parsed?.error, parsed?.statusCode);
      if (fromBody) return fromBody;
    } catch {
      /* keep the raw text */
    }
  }

  const statusMatch = text.match(/^(402|403)\b/);
  if (statusMatch && text.length < 40) {
    return statusSentence(Number(statusMatch[1])) || text;
  }
  if (text === "Forbidden") return statusSentence(403) || text;
  if (text === "Payment Required") return statusSentence(402) || text;

  return text.slice(0, 300);
}

export async function readApiErrorMessage(
  res: Response,
  fallback = "Operation failed. Please try again.",
): Promise<string> {
  try {
    const data = await res.clone().json();
    const explained = humanizeApiMessage(data?.message ?? data?.error, res.status);
    if (explained) return explained;
  } catch {
    /* try text */
  }

  try {
    const text = await res.clone().text();
    const explained = humanizeApiMessage(text, res.status);
    if (explained) return explained;
  } catch {
    /* ignore */
  }

  return statusSentence(res.status) || fallback;
}

export function messageFromUnknownError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const explained = humanizeApiMessage(raw);
  return explained || fallback;
}
