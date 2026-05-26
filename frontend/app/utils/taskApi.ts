import { getSidebarContext } from "./sidebarContext";

export type CurrentUserLike = {
  id?: number;
  role?: string;
  companyID?: number;
  serviceProviderID?: number;
  employee?: { id?: number };
};

function viewerFromToken(): CurrentUserLike | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const role = String(payload.role || "").toUpperCase();
    const isEmployee = role === "EMPLOYEE" || payload.type === "employee";
    return {
      id: isEmployee ? Number(payload.employeeId ?? payload.sub) : Number(payload.sub),
      role,
      companyID: payload.companyID ? Number(payload.companyID) : undefined,
      serviceProviderID: payload.serviceProviderID ? Number(payload.serviceProviderID) : undefined,
    };
  } catch {
    return null;
  }
}

export function buildTaskViewerQuery(user: CurrentUserLike | null | undefined) {
  const ctx = getSidebarContext();
  const u = user ?? viewerFromToken();
  const params = new URLSearchParams();
  const role = (u?.role || "").toUpperCase();
  if (role) params.set("viewerRole", role);
  if (u) {
    if (role === "EMPLOYEE") {
      const employeeId = u.employee?.id ?? u.id;
      if (employeeId) params.set("viewerEmployeeId", String(employeeId));
    } else if (u.id) {
      params.set("viewerUserId", String(u.id));
    }
  }
  const isEmployee = role === "EMPLOYEE";
  const companyID = isEmployee ? u?.companyID : (ctx?.companyID ?? u?.companyID);
  const spID = isEmployee ? u?.serviceProviderID : (ctx?.serviceProviderID ?? u?.serviceProviderID);
  if (companyID) params.set("companyID", String(companyID));
  if (spID) params.set("serviceProviderID", String(spID));
  return params;
}

export function taskApiUrl(path: string, user: CurrentUserLike | null | undefined, extra?: Record<string, string | number>) {
  const params = buildTaskViewerQuery(user);
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => params.set(k, String(v)));
  }
  const qs = params.toString();
  return `/backend${path}${qs ? `?${qs}` : ""}`;
}

export async function taskFetch<T>(path: string, user: CurrentUserLike | null | undefined, init?: RequestInit, extra?: Record<string, string | number>): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("accessToken") || "" : "";
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const res = await fetch(taskApiUrl(path, user, extra), { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || text);
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e;
      throw new Error(text || "Request failed");
    }
  }
  return res.json();
}
