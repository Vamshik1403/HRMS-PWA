/** Global signal for client pages to reload their data after mutations. */
export const APP_REFRESH_EVENT = "app-data-refresh";

type CacheClearer = () => void;
const cacheClearers = new Set<CacheClearer>();

/** Register a function to clear module-local GET caches when data changes. */
export function registerDataCacheClearer(clear: CacheClearer): () => void {
  cacheClearers.add(clear);
  return () => cacheClearers.delete(clear);
}

export function clearAllDataCaches(): void {
  cacheClearers.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function dispatchAppRefresh(): void {
  if (typeof window === "undefined") return;
  clearAllDataCaches();
  window.dispatchEvent(new Event(APP_REFRESH_EVENT));
  window.dispatchEvent(new Event("sidebar-refresh"));
}
