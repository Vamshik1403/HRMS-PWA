/**
 * Delete all internal messaging (employee memo) records — parents and replies.
 *
 *   cd backend && npx ts-node -r dotenv/config scripts/reset-employee-memos.ts
 *   add --dry-run to preview counts only
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const total = await prisma.employeeMemo.count();
  const general = await prisma.employeeMemo.count({
    where: { memoType: { equals: 'General', mode: 'insensitive' } },
  });
  const replies = await prisma.employeeMemo.count({
    where: { parentMemoId: { not: null } },
  });

  console.log(`Employee memos in database: ${total} (${general} General, ${replies} replies)`);

  if (dryRun) {
    console.log('Dry run — no rows deleted.');
    return;
  }

  const deleted = await prisma.employeeMemo.deleteMany({});
  console.log(`Deleted ${deleted.count} employee memo record(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
