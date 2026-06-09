/** Read OpenHRM JWT from localStorage or auth cookie (middleware uses cookie). */
export function getAccessToken(): string {
  if (typeof window === "undefined") return "";

  const fromStorage =
    localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  if (fromStorage) return fromStorage;

  const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}
