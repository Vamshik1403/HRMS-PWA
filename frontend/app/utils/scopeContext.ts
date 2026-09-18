import { isDesktopManagerFlagSet } from "@/lib/desktopManager";
import {
  hasCompanyAccessFlag,
  isCompanyAdminLikeRole,
  isCompanyOwnerFlag,
} from "@/lib/companyAccess";
import { getActiveCompanyId, getSidebarContext } from "./sidebarContext";

export type ScopedUser = {
  role?: string;
  username?: string;
  companyID?: number;
  activeCompanyID?: number;
  branchesID?: number;
  serviceProviderID?: number;
} | null;

export type ScopeRecord = {
  companyID?: number | null;
  branchesID?: number | null;
  serviceProviderID?: number | null;
  id?: number | string;
};

export function isDesktopManagerEmployee(user?: ScopedUser): boolean {
  return user?.role === "EMPLOYEE" && isDesktopManagerFlagSet();
}

export function canDesktopManagerManage(user?: ScopedUser): boolean {
  return isDesktopManagerEmployee(user);
}

/** Company owners / granted module operators logged in as EMPLOYEE. */
export function isCompanyModuleOperator(user?: ScopedUser): boolean {
  if (!user?.role) return false;
  if (isCompanyAdminLikeRole(user.role) || user.role === "ADMIN") return true;
  if (user.role === "EMPLOYEE") {
    return (
      isCompanyOwnerFlag() ||
      hasCompanyAccessFlag() ||
      isDesktopManagerEmployee(user)
    );
  }
  return false;
}

const toPositiveId = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Resolve the active company for forms/lists.
 * Admins with multiple companies follow the sidebar switcher (session + context).
 * Employee operators prefer credentials/user.companyID over stale sidebarContext
 * left behind by a previous admin session.
 */
export function resolveScopedCompanyId(
  user?: ScopedUser,
  ctx = getSidebarContext(),
): number | undefined {
  if (!user) return undefined;

  const userCompanyId = toPositiveId(user.companyID);
  const switchedId =
    getActiveCompanyId() ?? toPositiveId(ctx?.companyID) ?? toPositiveId(user.activeCompanyID);
  const ctxCompanyId = toPositiveId(ctx?.companyID);

  if (user.role === "EMPLOYEE" && (isCompanyModuleOperator(user) || userCompanyId)) {
    if (userCompanyId) {
      if (ctxCompanyId && ctxCompanyId === userCompanyId) return ctxCompanyId;
      return userCompanyId;
    }
  }

  if (switchedId) return switchedId;
  if (ctxCompanyId) return ctxCompanyId;
  return userCompanyId;
}

export function resolveScopedServiceProviderId(
  user?: ScopedUser,
  ctx = getSidebarContext(),
): number | undefined {
  if (!user) return undefined;
  const userSpId = toPositiveId(user.serviceProviderID);
  const ctxSpId = toPositiveId(ctx?.serviceProviderID);
  const companyId = resolveScopedCompanyId(user, ctx);

  if (user.role === "EMPLOYEE" && (isCompanyModuleOperator(user) || userSpId)) {
    if (userSpId) {
      if (ctxSpId && companyId && toPositiveId(ctx?.companyID) === companyId) {
        return ctxSpId;
      }
      return userSpId;
    }
  }

  if (ctxSpId) return ctxSpId;
  return userSpId;
}

export async function resolveEmployeeCreds(username?: string): Promise<{
  companyID?: number;
  branchesID?: number;
  serviceProviderID?: number;
  companyName?: string;
  branchName?: string;
  serviceProviderName?: string;
  manageEmployeeID?: number;
} | null> {
  if (!username) return null;
  try {
    const res = await fetch("/backend/manage-emp/credentials/all");
    const creds = await res.json();
    if (!Array.isArray(creds)) return null;
    const row = creds.find((c: { username?: string }) => c.username === username);
    if (!row) return null;
    return {
      companyID: toPositiveId(row.companyID ?? row.company?.id),
      branchesID: toPositiveId(row.branchesID ?? row.branches?.id),
      serviceProviderID: toPositiveId(
        row.serviceProviderID ?? row.serviceProvider?.id,
      ),
      companyName: row.companyName || row.company?.companyName || "",
      branchName: row.branchName || row.branches?.branchName || "",
      serviceProviderName:
        row.serviceProviderName || row.serviceProvider?.companyName || "",
      manageEmployeeID: toPositiveId(row.employeeID ?? row.employee?.id),
    };
  } catch {
    return null;
  }
}

export async function resolveAdminUserMapping(
  username?: string,
): Promise<ScopedUser | null> {
  if (!username) return null;
  try {
    const res = await fetch("/backend/users");
    const users = await res.json();
    if (!Array.isArray(users)) return null;
    return users.find((u: { username?: string }) => u.username === username) ?? null;
  } catch {
    return null;
  }
}

/** Resolve mapping for form auto-fill (stores user row on management pages). */
export async function resolveScopeUserMapping(
  user: ScopedUser,
): Promise<ScopedUser | null> {
  if (!user?.role) return null;
  if (isDesktopManagerEmployee(user)) {
    return {
      username: user.username,
      role: user.role,
      companyID: resolveScopedCompanyId(user),
      serviceProviderID: user.serviceProviderID,
      branchesID: user.branchesID,
    };
  }
  if (user.role === "EMPLOYEE") {
    const creds = await resolveEmployeeCreds(user.username);
    if (creds) {
      return {
        username: user.username,
        role: user.role,
        companyID: creds.companyID,
        branchesID: creds.branchesID,
        serviceProviderID: creds.serviceProviderID,
      };
    }
    return {
      username: user.username,
      role: user.role,
      companyID: user.companyID,
      branchesID: user.branchesID,
      serviceProviderID: user.serviceProviderID,
    };
  }
  return resolveAdminUserMapping(user.username);
}

/** Records scoped by company (and optionally branch for non-managers). */
export async function filterCompanyScopedRecords<T extends ScopeRecord>(
  all: T[],
  user: ScopedUser,
): Promise<T[]> {
  if (!user?.role) return [] as T[];

  if (user.role === "SUPERADMIN") {
    const ctx = getSidebarContext();
    if (ctx?.companyID) return all.filter((r) => r.companyID === ctx.companyID);
    return all;
  }

  if (isCompanyAdminLikeRole(user.role) || user.role === "ADMIN") {
    const companyId = resolveScopedCompanyId(user);
    return companyId != null
      ? all.filter((r) => Number(r.companyID) === Number(companyId))
      : ([] as T[]);
  }

  if (user.role === "SERVICE_PROVIDER") {
    const ctx = getSidebarContext();
    if (ctx?.companyID) {
      return all.filter((r) => Number(r.companyID) === Number(ctx.companyID));
    }
    const mapping = await resolveAdminUserMapping(user.username);
    const spId = mapping?.serviceProviderID ?? user.serviceProviderID;
    return spId != null
      ? all.filter((r) => Number(r.serviceProviderID) === Number(spId))
      : ([] as T[]);
  }

  if (user.role === "BRANCH_ADMIN") {
    const mapping = await resolveAdminUserMapping(user.username);
    const companyId = toPositiveId(mapping?.companyID ?? user.companyID);
    const branchId = toPositiveId(mapping?.branchesID ?? user.branchesID);
    if (companyId == null || branchId == null) return [] as T[];
    return all.filter(
      (r) =>
        Number(r.companyID) === Number(companyId) &&
        Number(r.branchesID) === Number(branchId),
    );
  }

  // Desktop managers + company owners / module operators share company-wide scope.
  // Resolve company from user, sidebar, then credentials (owners often lack branchesID).
  if (user.role === "EMPLOYEE" && isCompanyModuleOperator(user)) {
    const creds = await resolveEmployeeCreds(user.username);
    const companyId =
      resolveScopedCompanyId(user) ??
      toPositiveId(creds?.companyID) ??
      toPositiveId(user.companyID);
    return companyId != null
      ? all.filter((r) => Number(r.companyID) === Number(companyId))
      : ([] as T[]);
  }

  if (user.role === "EMPLOYEE") {
    const creds = await resolveEmployeeCreds(user.username);
    const companyId =
      toPositiveId(creds?.companyID) ??
      resolveScopedCompanyId(user) ??
      toPositiveId(user.companyID);
    const branchId =
      toPositiveId(creds?.branchesID) ?? toPositiveId(user.branchesID);
    if (companyId == null || branchId == null) return [] as T[];
    return all.filter(
      (r) =>
        Number(r.companyID) === Number(companyId) &&
        Number(r.branchesID) === Number(branchId),
    );
  }

  return [] as T[];
}

/** Branch rows use `id` as the branch identifier. */
export async function filterBranchesForUser<T extends ScopeRecord>(
  all: T[],
  user: ScopedUser,
): Promise<T[]> {
  if (!user?.role) return [];

  if (user.role === "SUPERADMIN") {
    const ctx = getSidebarContext();
    if (ctx?.companyID) return all.filter((r) => r.companyID === ctx.companyID);
    return all;
  }

  if (isCompanyAdminLikeRole(user.role) || user.role === "ADMIN") {
    const companyId = resolveScopedCompanyId(user);
    return companyId != null
      ? all.filter((r) => Number(r.companyID) === Number(companyId))
      : [];
  }

  if (user.role === "SERVICE_PROVIDER") {
    const ctx = getSidebarContext();
    if (ctx?.companyID) {
      return all.filter((r) => Number(r.companyID) === Number(ctx.companyID));
    }
    const mapping = await resolveAdminUserMapping(user.username);
    const spId = mapping?.serviceProviderID ?? user.serviceProviderID;
    return spId != null
      ? all.filter((r) => Number(r.serviceProviderID) === Number(spId))
      : [];
  }

  if (user.role === "BRANCH_ADMIN") {
    const mapping = await resolveAdminUserMapping(user.username);
    const companyId = toPositiveId(mapping?.companyID ?? user.companyID);
    const branchId = toPositiveId(mapping?.branchesID ?? user.branchesID);
    return companyId != null && branchId != null
      ? all.filter(
          (r) =>
            Number(r.companyID) === Number(companyId) &&
            Number(r.id) === Number(branchId),
        )
      : [];
  }

  if (user.role === "EMPLOYEE" && isCompanyModuleOperator(user)) {
    const creds = await resolveEmployeeCreds(user.username);
    const companyId =
      resolveScopedCompanyId(user) ??
      toPositiveId(creds?.companyID) ??
      toPositiveId(user.companyID);
    return companyId != null
      ? all.filter((r) => Number(r.companyID) === Number(companyId))
      : [];
  }

  if (user.role === "EMPLOYEE") {
    const creds = await resolveEmployeeCreds(user.username);
    const companyId =
      toPositiveId(creds?.companyID) ??
      resolveScopedCompanyId(user) ??
      toPositiveId(user.companyID);
    const branchId =
      toPositiveId(creds?.branchesID) ?? toPositiveId(user.branchesID);
    return companyId != null && branchId != null
      ? all.filter(
          (r) =>
            Number(r.companyID) === Number(companyId) &&
            Number(r.id) === Number(branchId),
        )
      : [];
  }

  return [];
}

export async function filterCompaniesForUser<
  T extends { id: number; serviceProviderID?: number | null; branchesID?: number | null },
>(all: T[], user: ScopedUser): Promise<T[]> {
  if (!user?.role) return [];

  if (user.role === "SUPERADMIN") {
    const ctx = getSidebarContext();
    if (ctx?.serviceProviderID) {
      return all.filter((c) => c.serviceProviderID === ctx.serviceProviderID);
    }
    return all;
  }

  if (user.role === "SERVICE_PROVIDER") {
    const ctx = getSidebarContext();
    if (ctx?.companyID) return all.filter((c) => c.id === ctx.companyID);
    if (user.serviceProviderID) {
      return all.filter((c) => c.serviceProviderID === user.serviceProviderID);
    }
    return [];
  }

  if (
    isCompanyAdminLikeRole(user.role) ||
    user.role === "ADMIN" ||
    user.role === "BRANCH_ADMIN"
  ) {
    const companyId = resolveScopedCompanyId(user);
    return companyId != null
      ? all.filter((c) => Number(c.id) === Number(companyId))
      : [];
  }

  if (user.role === "EMPLOYEE") {
    const creds = await resolveEmployeeCreds(user.username);
    const companyId =
      resolveScopedCompanyId(user) ??
      toPositiveId(creds?.companyID) ??
      toPositiveId(user.companyID);
    return companyId != null
      ? all.filter((c) => Number(c.id) === Number(companyId))
      : [];
  }

  return [];
}
