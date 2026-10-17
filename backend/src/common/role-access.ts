import { ForbiddenException } from '@nestjs/common';

type AuthUser = {
  role?: string;
  sub?: number | string;
  userId?: number | string;
  isCompanyOwner?: boolean;
};

export function requestRole(user?: AuthUser | null): string {
  return String(user?.role || '').toUpperCase();
}

export function isSuperadmin(user?: AuthUser | null): boolean {
  return requestRole(user) === 'SUPERADMIN';
}

const COMPANY_DIRECTORY_ROLES = new Set([
  'SUPERADMIN',
  'SERVICE_PROVIDER',
  'COMPANY_ADMIN',
  'MULTI_COMPANY_ADMIN',
  'ADMIN',
  'BRANCH_ADMIN',
]);

export function canReadCompanyDirectory(user?: AuthUser | null): boolean {
  if (COMPANY_DIRECTORY_ROLES.has(requestRole(user))) return true;
  return requestRole(user) === 'EMPLOYEE' && user?.isCompanyOwner === true;
}

export function assertSuperadmin(user?: AuthUser | null): void {
  if (!isSuperadmin(user)) {
    throw new ForbiddenException('You do not have permission to access this page');
  }
}

export function assertCompanyDirectory(user?: AuthUser | null): void {
  if (!canReadCompanyDirectory(user)) {
    throw new ForbiddenException('You do not have permission to access this page');
  }
}

export function assertSelfOrSuperadmin(user: AuthUser | undefined, id: number): void {
  if (isSuperadmin(user)) return;
  if (requestRole(user) === 'EMPLOYEE' || (user as { type?: string } | undefined)?.type === 'employee') {
    throw new ForbiddenException('You do not have permission to access this page');
  }
  const self = Number(user?.sub ?? user?.userId);
  if (Number.isFinite(self) && self === id) return;
  throw new ForbiddenException('You do not have permission to access this page');
}
