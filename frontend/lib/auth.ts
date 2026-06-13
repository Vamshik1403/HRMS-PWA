/** Read OpenHRM JWT from localStorage or auth cookie (middleware uses cookie). */
import { isJwtExpired } from "./jwtUtils";

export function getAccessToken(): string {
  if (typeof window === "undefined") return "";

  const fromStorage =
    localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  if (fromStorage) {
    if (isJwtExpired(fromStorage)) {
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      return "";
    }
    return fromStorage;
  }

  const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]+)/);
  const fromCookie = match ? decodeURIComponent(match[1]) : "";
  if (fromCookie && isJwtExpired(fromCookie)) {
    document.cookie = "accessToken=; path=/; max-age=0";
    return "";
  }
  return fromCookie;
}

export function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}
