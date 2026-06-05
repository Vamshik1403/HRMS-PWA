/**
 * One-off: delete reimbursement claims for Vamshik Maidham and reset leave balance.
 * Does NOT touch attendance / punch records.
 *
 *   cd backend && npx ts-node -r dotenv/config scripts/reset-vamshik-reimb-and-leave-balance.ts
 *   add --dry-run to preview
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function findVamshik() {
  const byCode = await prisma.manageEmployee.findFirst({
    where: { employeeID: { equals: 'EMPL_123', mode: 'insensitive' } },
    select: { id: true, employeeID: true, employeeFirstName: true, employeeLastName: true },
  });
  if (byCode) return byCode;

  return prisma.manageEmployee.findFirst({
    where: {
      AND: [
        { employeeFirstName: { contains: 'vamshik', mode: 'insensitive' } },
        { employeeLastName: { contains: 'maidham', mode: 'insensitive' } },
      ],
    },
    select: { id: true, employeeID: true, employeeFirstName: true, employeeLastName: true },
  });
}

async function main() {
  const emp = await findVamshik();
  if (!emp) {
    console.error('Employee Vamshik Maidham not found.');
    process.exit(1);
  }

  console.log(`Employee: ${emp.employeeFirstName} ${emp.employeeLastName} (id=${emp.id}, code=${emp.employeeID})`);

  const reimbs = await prisma.reimbursement.findMany({
    where: { manageEmployeeID: emp.id },
    select: { id: true, status: true, date: true },
  });
  console.log(`Reimbursements to delete: ${reimbs.length}`, reimbs);

  const balance = await prisma.empLeaveBalance.findUnique({
    where: { manageEmployeeID: emp.id },
  });
  console.log('Leave balance row:', balance ?? '(none)');

  if (dryRun) {
    console.log('Dry run — no changes written.');
    return;
  }

  const legacyReimb = await prisma.reimbursement.updateMany({
    where: { status: 'Partly Approved' },
    data: { status: 'Partially Approved' },
  });
  const legacyLeave = await prisma.leaveApplication.updateMany({
    where: { status: 'Partly Approved' },
    data: { status: 'Partially Approved' },
  });
  if (legacyReimb.count || legacyLeave.count) {
    console.log(`Migrated status labels: ${legacyReimb.count} reimbursement(s), ${legacyLeave.count} leave(s).`);
  }

  if (reimbs.length > 0) {
    const ids = reimbs.map((r) => r.id);
    await prisma.reimbursementItem.deleteMany({ where: { reimbursementID: { in: ids } } });
    const deleted = await prisma.reimbursement.deleteMany({ where: { manageEmployeeID: emp.id } });
    console.log(`Deleted ${deleted.count} reimbursement(s).`);
  }

  const bal = await prisma.empLeaveBalance.deleteMany({ where: { manageEmployeeID: emp.id } });
  console.log(`Deleted ${bal.count} leave balance row(s) (will re-init on next use).`);

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
