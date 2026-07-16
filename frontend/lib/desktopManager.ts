/** Desktop manager = employee login with direct reportees; uses employee portal with Team / My Company zones. */

export const DESKTOP_MANAGER_KEY = "openhrmDesktopManager";

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isDesktopBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= 768 && !isPwaStandalone();
}

export function isDesktopManagerFlagSet(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DESKTOP_MANAGER_KEY) === "1";
}

export function setDesktopManagerFlag(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) localStorage.setItem(DESKTOP_MANAGER_KEY, "1");
  else localStorage.removeItem(DESKTOP_MANAGER_KEY);
}

export async function resolveDesktopManagerAfterLogin(
  accessToken: string,
  backend = "/backend",
): Promise<boolean> {
  if (!isDesktopBrowser()) {
    setDesktopManagerFlag(false);
    return false;
  }
  try {
    const res = await fetch(`${backend}/emp-manager-scope/reportees`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      setDesktopManagerFlag(false);
      return false;
    }
    const data = await res.json();
    const isManager = !!data?.hasReportees;
    setDesktopManagerFlag(isManager);
    return isManager;
  } catch {
    setDesktopManagerFlag(false);
    return false;
  }
}
