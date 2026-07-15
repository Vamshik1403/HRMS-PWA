export async function readApiErrorMessage(
  res: Response,
  fallback = "Operation failed. Please try again.",
): Promise<string> {
  try {
    const data = await res.clone().json();
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (Array.isArray(data?.message) && data.message.length > 0) {
      return data.message.map(String).join(", ");
    }
  } catch {
    /* try text */
  }

  try {
    const text = await res.clone().text();
    if (text?.trim()) {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.message === "string") return parsed.message;
      } catch {
        return text.slice(0, 300);
      }
    }
  } catch {
    /* ignore */
  }

  return fallback;
}
