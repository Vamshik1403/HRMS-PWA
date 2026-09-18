"use client";

import { dispatchAppRefresh } from "./appRefresh";

let patched = false;
let redirectingForExpiredSubscription = false;

function handleSubscriptionExpired() {
  if (redirectingForExpiredSubscription || typeof window === "undefined") return;
  redirectingForExpiredSubscription = true;
  try {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  } catch {
    /* ignore */
  }
  const message = encodeURIComponent(
    "Your company subscription has expired. Please contact your administrator to renew it.",
  );
  window.location.href = `/login?subscriptionExpired=1&msg=${message}`;
}

/** After any successful mutating /backend/* request, refresh open list pages. */
export function ensureFetchRefreshPatch(): void {
  if (patched || typeof window === "undefined") return;
  patched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let nextInit = init;
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("/backend/")) {
        const activeCompanyID = Number(sessionStorage.getItem("activeCompanyID") || 0);
        if (Number.isFinite(activeCompanyID) && activeCompanyID > 0) {
          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : undefined),
          );
          if (!headers.has("X-Active-Company-ID")) {
            headers.set("X-Active-Company-ID", String(activeCompanyID));
          }
          nextInit = { ...(init || {}), headers };
        }
      }
    } catch {
      /* ignore */
    }

    const res = await originalFetch(input, nextInit);
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (res.status === 401 && url.includes("/backend/") && !url.includes("/auth/login")) {
        const clone = res.clone();
        clone
          .json()
          .then((body: any) => {
            if (body?.message === "SUBSCRIPTION_EXPIRED") {
              handleSubscriptionExpired();
            }
          })
          .catch(() => {});
      }

      const method = (init?.method || "GET").toUpperCase();
      if (!res.ok || method === "GET" || method === "HEAD") return res;

      if (url.includes("/backend/") && !url.includes("/auth/")) {
        dispatchAppRefresh();
      }
    } catch {
      /* ignore */
    }
    return res;
  };
}
