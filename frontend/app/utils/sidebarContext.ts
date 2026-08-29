// Stores the active Service Provider and Company context from sidebar navigation.
// Used by form modals to auto-select SP/Company when creating new records.

const STORAGE_KEY = "sidebarContext";

interface SidebarContextData {
  serviceProviderID: number;
  serviceProviderName: string;
  companyID: number;
  companyName: string;
}

export function setSidebarContext(
  spId: number,
  spName: string,
  companyId: number,
  companyName: string
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ serviceProviderID: spId, serviceProviderName: spName, companyID: companyId, companyName: companyName })
    );
    window.dispatchEvent(new Event("sidebar-context-changed"));
  } catch { /* ignore */ }
}

export function getSidebarContext(): SidebarContextData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Active company from the sidebar switcher (session), then persisted sidebar context. */
export function getActiveCompanyId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const session = Number(sessionStorage.getItem("activeCompanyID") || 0);
    if (Number.isFinite(session) && session > 0) return session;
  } catch {
    /* ignore */
  }
  const ctxId = Number(getSidebarContext()?.companyID || 0);
  if (Number.isFinite(ctxId) && ctxId > 0) return ctxId;
  return null;
}

export function clearSidebarContext() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
