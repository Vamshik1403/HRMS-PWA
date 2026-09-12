import { PrismaService } from '../prisma/prisma.service';

/**
 * If branchesID is missing or belongs to another company, snap it to a branch
 * of the given company (first by id). Prevents company/branch mismatches that
 * drop shifts and policies from company-scoped reports.
 */
export async function snapBranchesIDToCompany(
  prisma: PrismaService,
  companyID: number | null | undefined,
  branchesID: number | null | undefined,
): Promise<number | null> {
  const company = Number(companyID);
  if (!Number.isFinite(company) || company <= 0) {
    const raw = Number(branchesID);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }

  const requested = Number(branchesID);
  if (Number.isFinite(requested) && requested > 0) {
    const branch = await prisma.branches.findUnique({
      where: { id: requested },
      select: { id: true, companyID: true },
    });
    if (branch && Number(branch.companyID) === company) {
      return branch.id;
    }
  }

  const fallback = await prisma.branches.findFirst({
    where: { companyID: company },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return fallback?.id ?? null;
}
