import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const EMAIL_ALREADY_USED = 'Cannot use this email as it is used already.';

/** One stored field may be a single address, a pipe list, or a JSON array. */
export function emailAddressesFromStored(raw?: string | null): string[] {
  const value = String(raw ?? '').trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item ?? '').trim().toLowerCase())
          .filter((item) => item.includes('@'));
      }
    } catch {
      /* plain text */
    }
  }
  const parts = value.includes('|') ? value.split('|') : [value];
  return parts
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.includes('@'));
}

function fieldHasEmail(raw: string | null | undefined, email: string): boolean {
  return emailAddressesFromStored(raw).includes(email);
}

/**
 * An email may belong to only one live account: employee, owner, admin, or superadmin.
 * The same person may keep it on their own business and personal fields, and on their user profile.
 */
export async function assertEmailNotInUse(
  prisma: PrismaService,
  rawEmails: Array<string | null | undefined>,
  opts?: { excludeEmployeeId?: number; excludeUserId?: number },
): Promise<void> {
  const wanted = new Set<string>();
  for (const raw of rawEmails) {
    for (const address of emailAddressesFromStored(raw)) {
      wanted.add(address);
    }
  }
  if (wanted.size === 0) return;

  // A deleted employee must not keep the address. Audit rows are not accounts.
  await prisma.manageEmployee.updateMany({
    where: {
      isDeleted: true,
      OR: [{ businessEmail: { not: null } }, { personalEmail: { not: null } }],
    },
    data: { businessEmail: null, personalEmail: null },
  });

  for (const email of wanted) {
    const employees = await prisma.manageEmployee.findMany({
      where: {
        isDeleted: false,
        ...(opts?.excludeEmployeeId ? { id: { not: opts.excludeEmployeeId } } : {}),
        OR: [
          { businessEmail: { contains: email, mode: 'insensitive' } },
          { personalEmail: { contains: email, mode: 'insensitive' } },
        ],
      },
      select: { businessEmail: true, personalEmail: true },
      take: 30,
    });
    if (
      employees.some(
        (row) => fieldHasEmail(row.businessEmail, email) || fieldHasEmail(row.personalEmail, email),
      )
    ) {
      throw new ConflictException(EMAIL_ALREADY_USED);
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        ...(opts?.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (user) throw new ConflictException(EMAIL_ALREADY_USED);

    const profile = await prisma.userProfile.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        ...(opts?.excludeUserId ? { userId: { not: opts.excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (profile) throw new ConflictException(EMAIL_ALREADY_USED);
  }
}
