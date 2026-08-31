import { PrismaService } from '../prisma/prisma.service';

export function normalizeFederalDomainCode(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export async function getMutuallyLinkedCompanyIds(
  prisma: PrismaService,
  companyId: number,
): Promise<number[]> {
  if (!companyId) return [];
  const mine = await prisma.companyFederalDomain.findMany({
    where: { companyID: companyId },
    select: { code: true },
  });
  if (!mine.length) return [];
  const codes = [...new Set(mine.map((row) => row.code).filter(Boolean))];
  if (!codes.length) return [];
  const others = await prisma.companyFederalDomain.findMany({
    where: { code: { in: codes }, companyID: { not: companyId } },
    select: { companyID: true },
  });
  return [...new Set(others.map((row) => row.companyID))];
}
