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
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ serviceProviderID: spId, serviceProviderName: spName, companyID: companyId, companyName: companyName })
    );
  } catch { /* ignore */ }
}

export function getSidebarContext(): SidebarContextData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSidebarContext() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
