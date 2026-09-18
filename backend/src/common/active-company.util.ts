import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function headerCompanyId(req?: { headers?: Record<string, unknown> }): number | null {
  const raw =
    req?.headers?.['x-active-company-id'] ??
    req?.headers?.['X-Active-Company-ID'];
  return toPositiveId(raw);
}

/**
 * For MULTI_COMPANY_ADMIN, prefer the switched company (header or requested ID)
 * when it is in UserCompany. Other tenant roles stay on JWT companyID.
 */
export async function resolveActiveCompanyForUser(
  prisma: PrismaService,
  req?: { user?: { sub?: number; id?: number; role?: string; companyID?: number }; headers?: Record<string, unknown> },
  requestedCompanyID?: number | null,
): Promise<number | null> {
  const user = req?.user ?? null;
  const role = String(user?.role || '').toUpperCase();
  if (!role || role === 'SUPERADMIN' || role === 'SERVICE_PROVIDER') {
    return toPositiveId(requestedCompanyID);
  }

  if (role === 'MULTI_COMPANY_ADMIN') {
    const userId = toPositiveId(user?.sub ?? user?.id);
    const assigned = userId
      ? await prisma.userCompany.findMany({
          where: { userID: userId },
          select: { companyID: true, isPrimary: true },
        })
      : [];
    const assignedIds = assigned
      .map((row) => toPositiveId(row.companyID))
      .filter((id): id is number => !!id);
    const requested = headerCompanyId(req) ?? toPositiveId(requestedCompanyID);
    if (requested) {
      if (!assignedIds.includes(requested)) {
        throw new BadRequestException('You do not have access to this company');
      }
      return requested;
    }
    const primary = assigned.find((row) => row.isPrimary);
    return (
      toPositiveId(primary?.companyID) ??
      toPositiveId(user?.companyID) ??
      assignedIds[0] ??
      null
    );
  }

  return toPositiveId(user?.companyID);
}
