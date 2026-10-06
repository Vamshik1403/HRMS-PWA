import { ForbiddenException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  COMPANY_MODULE_KEYS,
  fullOwnerPermissions,
  hasModuleAction,
  type ModulePermissionDto,
} from './company-module-permissions';
import {
  isSubscriptionExemptCompany,
  rightsKeysCoveredByProductModules,
} from './product-modules';

/**
 * Rights keys the company's plan covers.
 * null means unrestricted (exempt companies, and callers with no company).
 */
export async function entitledRightsKeys(
  prisma: PrismaService,
  companyId: number | null | undefined,
): Promise<Set<string> | null> {
  if (!companyId || isSubscriptionExemptCompany(companyId)) return null;
  const latest = await prisma.companySubscription.findFirst({
    where: { companyID: companyId },
    orderBy: { endDate: 'desc' },
    include: {
      plan: { include: { assignedModules: { include: { module: true } } } },
    },
  });
  if (!latest || !latest.isActive || latest.status !== SubscriptionStatus.ACTIVE) {
    return new Set();
  }
  const now = Date.now();
  const start = new Date(latest.startDate).getTime();
  const end = new Date(latest.endDate).getTime();
  if (start > now || end < now) return new Set();
  const productKeys = (latest.plan?.assignedModules || [])
    .map((row) => row.module?.moduleKey)
    .filter((key): key is string => !!key);
  return rightsKeysCoveredByProductModules(productKeys);
}

export function limitPermissionsToPlan(
  permissions: ModulePermissionDto[],
  entitled: Set<string> | null,
): ModulePermissionDto[] {
  if (!entitled) return permissions;
  return permissions.filter((row) => entitled.has(row.moduleKey));
}

export async function loadEmployeePermissions(
  prisma: PrismaService,
  manageEmployeeId: number,
  companyId: number | null | undefined,
  isCompanyOwner: boolean,
): Promise<ModulePermissionDto[]> {
  const entitled = companyId ? await entitledRightsKeys(prisma, companyId) : null;
  if (!companyId) return isCompanyOwner ? fullOwnerPermissions() : [];
  if (isCompanyOwner) return limitPermissionsToPlan(fullOwnerPermissions(), entitled);

  const rows = await prisma.employeeModulePermission.findMany({
    where: { manageEmployeeID: manageEmployeeId, companyID: companyId },
    select: {
      moduleKey: true,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    },
  });
  const byKey = new Map(rows.map((r) => [r.moduleKey, r]));
  return limitPermissionsToPlan(
    COMPANY_MODULE_KEYS.map((moduleKey) => {
      const row = byKey.get(moduleKey);
      return {
        moduleKey,
        canView: row?.canView ?? false,
        canCreate: row?.canCreate ?? false,
        canEdit: row?.canEdit ?? false,
        canDelete: row?.canDelete ?? false,
      };
    }),
    entitled,
  );
}

export async function assertEmployeeModuleAccess(
  prisma: PrismaService,
  opts: {
    manageEmployeeId: number;
    companyId: number;
    isCompanyOwner?: boolean;
    moduleKey: string;
    action: 'view' | 'create' | 'edit' | 'delete';
  },
): Promise<void> {
  const isOwner = !!opts.isCompanyOwner;
  const permissions = await loadEmployeePermissions(
    prisma,
    opts.manageEmployeeId,
    opts.companyId,
    isOwner,
  );
  if (!hasModuleAction(permissions, false, opts.moduleKey, opts.action)) {
    throw new ForbiddenException(
      `You do not have ${opts.action} access to ${opts.moduleKey}`,
    );
  }
}
