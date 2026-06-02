/** Parse stored scalar (plain, pipe-separated, or JSON array) into a list for multi inputs. */
export function parseMultiValue(raw: string | null | undefined): string[] {
  const s = (raw ?? "").trim();
  if (!s) return [""];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        const list = parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
        return list.length ? list : [""];
      }
    } catch {
      /* fall through */
    }
  }
  if (s.includes("|")) {
    const list = s.split("|").map((x) => x.trim()).filter(Boolean);
    return list.length ? list : [""];
  }
  return [s];
}

/** Serialize multi inputs for API storage (JSON if multiple, plain string if one). */
export function joinMultiValue(values: string[]): string {
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  return JSON.stringify(cleaned);
}

export function primaryMultiValue(values: string[]): string {
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  return cleaned[0] ?? "";
}
