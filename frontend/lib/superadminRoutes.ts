export const SUPERADMIN_ONLY_PREFIXES = [
  "/audit-logs",
  "/superdashboard",
  "/system-users",
  "/subscription",
  "/service-providers",
  "/policy-management",
];

export function isSuperadminOnlyPath(pathname: string): boolean {
  return SUPERADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Tenants list. Exact /company only, so /company-hierarchy stays a company page. */
export function isTenantsPath(pathname: string): boolean {
  return pathname === "/company" || pathname.startsWith("/company/");
}

/** Company admins use My Company. Employees do not get the tenants screen. */
export function isDeniedTenantsRole(role: string | null | undefined): boolean {
  const value = String(role || "").toUpperCase();
  return value === "EMPLOYEE" || value === "COMPANY_ADMIN" || value === "MULTI_COMPANY_ADMIN";
}

/** Same-site path only. Rejects protocol-relative and external URLs. */
export function safeNextPath(raw: string | null | undefined): string | null {
  const next = String(raw || "");
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return null;
  return next;
}
