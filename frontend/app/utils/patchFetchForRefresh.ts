"use client";

import { dispatchAppRefresh } from "./appRefresh";

let patched = false;

/** After any successful mutating /backend/* request, refresh open list pages. */
export function ensureFetchRefreshPatch(): void {
  if (patched || typeof window === "undefined") return;
  patched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await originalFetch(input, init);
    try {
      const method = (init?.method || "GET").toUpperCase();
      if (!res.ok || method === "GET" || method === "HEAD") return res;

      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (url.includes("/backend/") && !url.includes("/auth/")) {
        dispatchAppRefresh();
      }
    } catch {
      /* ignore */
    }
    return res;
  };
}
