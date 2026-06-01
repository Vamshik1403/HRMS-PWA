/** Backend API base (includes /backend proxy in production). */
export function getBackendBase(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";
}

/** Turn stored upload path into a browser URL that reaches Nest static /uploads. */
export function resolveUploadUrl(stored: string | null | undefined): string {
  if (!stored?.trim()) return "";
  const v = stored.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const base = getBackendBase().replace(/\/$/, "");
  if (v.startsWith("/backend/uploads/")) return v;
  if (v.startsWith("/uploads/")) return `${base}${v}`;
  if (v.startsWith("uploads/")) return `${base}/${v}`;
  return `${base}/uploads/${v.replace(/^\//, "")}`;
}

/** Normalize value saved on company/branch/contractor records. */
export function normalizeUploadPath(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const v = url.trim();
  if (v.startsWith("/backend/uploads/")) return v;
  if (v.startsWith("/uploads/")) return `/backend${v}`;
  if (v.startsWith("http")) {
    try {
      const u = new URL(v);
      if (u.pathname.startsWith("/uploads/")) return `/backend${u.pathname}`;
    } catch {
      /* ignore */
    }
    return v;
  }
  return `/backend/uploads/${v.replace(/^\//, "")}`;
}
