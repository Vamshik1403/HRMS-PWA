/** Desktop manager = employee login with direct reportees; uses employee portal with Team / My Company zones. */

export const DESKTOP_MANAGER_KEY = "openhrmDesktopManager";
const MOBILE_PWA_LAYOUT_KEY = "_openhrm_mobile_pwa_layout";

function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ reports as Mac but is touch-first
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1) {
    return true;
  }
  return false;
}

function rememberMobilePwaLayout() {
  try {
    localStorage.setItem(MOBILE_PWA_LAYOUT_KEY, "1");
  } catch {
    /* ignore */
  }
}

function hasRememberedMobilePwaLayout(): boolean {
  try {
    return localStorage.getItem(MOBILE_PWA_LAYOUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) {
    rememberMobilePwaLayout();
    return true;
  }
  try {
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches
    ) {
      rememberMobilePwaLayout();
      return true;
    }
  } catch {
    /* ignore */
  }
  // Android TWA / some WebAPK launches
  if (typeof document !== "undefined" && document.referrer.startsWith("android-app://")) {
    rememberMobilePwaLayout();
    return true;
  }
  return hasRememberedMobilePwaLayout();
}

/**
 * True only for real desktop browser windows.
 * Installed mobile PWAs and phone/tablet UAs never get the desktop sidebar shell.
 */
export function isDesktopBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-emp-layout") === "mobile"
  ) {
    return false;
  }
  if (isPwaStandalone()) return false;
  if (isMobileUserAgent()) return false;
  try {
    if (window.matchMedia("(max-width: 767px)").matches) return false;
  } catch {
    if (window.innerWidth < 768) return false;
  }
  return window.innerWidth >= 768;
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
