import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  COMPANY_MODULE_KEYS,
  fullOwnerPermissions,
  hasModuleAction,
  type ModulePermissionDto,
} from './company-module-permissions';

export async function loadEmployeePermissions(
  prisma: PrismaService,
  manageEmployeeId: number,
  companyId: number | null | undefined,
  isCompanyOwner: boolean,
): Promise<ModulePermissionDto[]> {
  if (!companyId) return isCompanyOwner ? fullOwnerPermissions() : [];
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
  if (isCompanyOwner && rows.length === 0) return fullOwnerPermissions();
  const byKey = new Map(rows.map((r) => [r.moduleKey, r]));
  return COMPANY_MODULE_KEYS.map((moduleKey) => {
    const row = byKey.get(moduleKey);
    return {
      moduleKey,
      canView: row?.canView ?? false,
      canCreate: row?.canCreate ?? false,
      canEdit: row?.canEdit ?? false,
      canDelete: row?.canDelete ?? false,
    };
  });
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
